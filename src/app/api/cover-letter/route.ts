import { NextResponse } from "next/server";
import { matchProfileToJob } from "@/lib/matching";
import { cleanJobText } from "@/lib/jobs";
import { rateLimited } from "@/lib/ratelimit";
import type { Job, UserProfile } from "@/lib/types";

const SYSTEM = `You are helping a fresher/intern write a short, honest cover letter.
Rules:
- Keep it truthful: use only the candidate's real skills, projects, and experience. Never invent jobs, degrees, or metrics.
- 3 short paragraphs + sign-off, under 180 words.
- Paragraph 1: the exact role + company, top 2-3 genuinely matching skills.
- Paragraph 2: ONE concrete project or experience bullet tied to the job.
- Paragraph 3: name 1-2 gaps honestly as "currently learning", close with a call to a short conversation.
- Warm, confident, no begging, no cliches like "passionate ninja". Plain text only.`;

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
      const { localCoverLetter } = await import("@/lib/resume");
      return NextResponse.json({
        letter: localCoverLetter(profile, job),
        match,
        engine: "local-fallback (add ANTHROPIC_API_KEY for Claude)",
      });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const userMsg = `CANDIDATE:\nName: ${profile.name}\nEmail: ${profile.email}\nSkills: ${profile.skills.join(", ")}\nSummary: ${profile.summary}\nProjects: ${JSON.stringify(profile.projects.slice(0, 3))}\nExperience: ${JSON.stringify(profile.experience.slice(0, 3))}\n\nTARGET JOB:\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nDescription:\n${cleanJobText(job.description || "", 3000)}\n\nMatch analysis:\n${JSON.stringify(match, null, 2)}\n\nWrite the cover letter now.`;

    const msg = await client.messages.create({
      model,
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as unknown as { text: string }).text ?? "")
      .join("\n");

    return NextResponse.json({ letter: text, match, engine: `claude:${model}` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "cover letter failed" },
      { status: 500 }
    );
  }
}
