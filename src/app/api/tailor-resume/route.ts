import { NextResponse } from "next/server";
import { matchProfileToJob } from "@/lib/matching";
import { cleanJobText } from "@/lib/jobs";
import { generateWithAI } from "@/lib/ai";
import { rateLimited } from "@/lib/ratelimit";
import type { Job, UserProfile } from "@/lib/types";

const SYSTEM = `You are an expert resume writer for freshers/interns.
Rewrite the candidate's resume, SUPER tailored to the specific job described below.
Rules:
- Keep it truthful: do not invent jobs, degrees, dates, phones, links, or metrics. You may rephrase and emphasize relevant skills/projects.
- If an EXISTING RESUME is provided, tailor THAT resume: preserve its real content and structure, reorder skills so matched ones come first, rewrite bullets to mirror job keywords (action verbs, scope).
- If no existing resume is given, build one from the profile: lead with a 2-line summary naming the target role + top 3 matching skills.
- Use profile links/phones/education exactly as given; omit any line you don't have data for. Never invent URLs.
- Keep the resume itself to one page (~450 words max).
- ATS safety (applicant tracking systems parse this): plain ASCII only inside the resume — use "-" for bullets and "-" instead of dashes, no emoji, no symbols, no tables. Use standard section headings exactly as in the blueprint.
- Section 1 purity: the FINAL RESUME must contain ONLY resume content — no match scores, no commentary like "why this fits", no instructions, no mention of any AI tool or service. Explanations belong in sections 2-4 only.

FINAL REVIEW
Before producing the final resume, internally evaluate it as:
### ATS
Would this resume match the important requirements for the advertised position?
### RECRUITER
Would I shortlist this fresher candidate based on the first 10 seconds?
### TECHNICAL HIRING MANAGER
Do the projects demonstrate that this candidate can learn and contribute to application development?
### CREDIBILITY
Does anything sound exaggerated, fabricated, or AI-generated?
Fix any problems you identify.

OUTPUT
Give exactly:
### 1. FINAL RESUME
The complete one-page resume, ready to copy into Word/Google Docs.
Do not put explanations inside the resume.
Follow this blueprint skeleton exactly (plain text, omit any section with no content):

<NAME>
<City>, <Country> | Phone: <phone>
LinkedIn: <url>  |  GitHub: <url>

EDUCATION
<Degree>
<College>  /  <Year>

TECHNICAL SKILLS
Programming: <hard skills, matched-first>
Development Approach: <how they build: prototyping, debugging, iteration — only if true>
Design: <design skills, if any>
Other: <everything else relevant>

PROJECTS
<Project Title>  /  <Ongoing or year, if known>
- 3-4 bullets per project: action verb + what was built + tech + outcome or scope. Mirror job keywords where truthful.

LEADERSHIP EXPERIENCE
<Role>  /  <Organization>
- Bullets from experience, angled at the target job. Only if experience exists.

### 2. WHY THIS RESUME FITS
Briefly explain how the resume was tailored specifically for the advertised position and company.
### 3. REMAINING GAPS
Tell which requirements of the role the candidate currently does not demonstrate.
Be completely honest.
### 4. LAST-MINUTE IMPROVEMENTS
Give 3-5 realistic things the candidate could do before applying that would strengthen the application.
Do not recommend fake resume padding.`;

export async function POST(req: Request) {
  const rl = rateLimited(req);
  if (rl.limited) {
    return NextResponse.json(
      { error: `Too many generations — try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  try {
    const { profile, job } = (await req.json()) as {
      profile: UserProfile;
      job: Job;
    };
    if (!profile || !job)
      return NextResponse.json({ error: "profile + job required" }, { status: 400 });

    const match = matchProfileToJob(profile, job);

    const cleanDescription = cleanJobText(job.description || "", 4000);
    const existingResume = (profile.resumeText || "").trim().slice(0, 6000);
    const userMsg = `CANDIDATE PROFILE:\n${JSON.stringify({ ...profile, resumeText: undefined }, null, 2)}\n\n${
      existingResume
        ? `EXISTING RESUME (tailor THIS — preserve its real content, do not invent new jobs):\n${existingResume}\n\n`
        : `NO EXISTING RESUME — build one from the profile above.\n\n`
    }TARGET JOB:\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nWork mode: ${job.workMode || "unknown"}\nDescription:\n${cleanDescription}\nTags: ${job.tags.join(", ")}\n\nMatch analysis:\n${JSON.stringify(match, null, 2)}\n\nWrite the tailored resume now.`;

    // Claude (paid) -> Gemini (free tier) -> local fallback
    const gen = await generateWithAI({ system: SYSTEM, user: userMsg, maxTokens: 1500 });
    if (!gen) {
      const { localTailor } = await import("@/lib/resume");
      return NextResponse.json({
        resume: localTailor(profile, job),
        match,
        engine: "local-fallback (add GEMINI_API_KEY for free AI or ANTHROPIC_API_KEY for Claude)",
      });
    }

    return NextResponse.json({ resume: gen.text, match, engine: gen.engine });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "tailor failed" },
      { status: 500 }
    );
  }
}
