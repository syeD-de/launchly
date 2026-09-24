import { NextResponse } from "next/server";
import { matchProfileToJob } from "@/lib/matching";
import { cleanJobText } from "@/lib/jobs";
import { rateLimited } from "@/lib/ratelimit";
import type { Job, UserProfile } from "@/lib/types";

const SYSTEM = `You are an expert resume writer for freshers/interns.
Rewrite the candidate's resume, SUPER tailored to the specific job described below.
Rules:
- Keep it truthful: do not invent jobs, degrees, dates, or metrics. You may rephrase and emphasize relevant skills/projects.
- If an EXISTING RESUME is provided, tailor THAT resume: preserve its real content and structure, reorder skills so matched ones come first, rewrite bullets to mirror job keywords (action verbs, scope).
- If no existing resume is given, build one from the profile: lead with a 2-line summary naming the target role + top 3 matching skills.
- Include a LINKS line under the name with the candidate's GitHub/LinkedIn URLs when provided (use them exactly as given, do not invent URLs).
- Keep the resume itself to one page (~450 words max).

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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-5";

    if (!apiKey) {
      // Fallback so app works without key
      const { localTailor } = await import("@/lib/resume");
      return NextResponse.json({
        resume: localTailor(profile, job),
        match,
        engine: "local-fallback (add ANTHROPIC_API_KEY for Claude)",
      });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const cleanDescription = cleanJobText(job.description || "", 4000);
    const existingResume = (profile.resumeText || "").trim().slice(0, 6000);
    const userMsg = `CANDIDATE PROFILE:\n${JSON.stringify({ ...profile, resumeText: undefined }, null, 2)}\n\n${
      existingResume
        ? `EXISTING RESUME (tailor THIS — preserve its real content, do not invent new jobs):\n${existingResume}\n\n`
        : `NO EXISTING RESUME — build one from the profile above.\n\n`
    }TARGET JOB:\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nWork mode: ${job.workMode || "unknown"}\nDescription:\n${cleanDescription}\nTags: ${job.tags.join(", ")}\n\nMatch analysis:\n${JSON.stringify(match, null, 2)}\n\nWrite the tailored resume now.`;

    const msg = await client.messages.create({
      model,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as unknown as { text: string }).text ?? "")
      .join("\n");

    return NextResponse.json({ resume: text, match, engine: `claude:${model}` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "tailor failed" },
      { status: 500 }
    );
  }
}
