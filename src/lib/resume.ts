import type { Job, UserProfile } from "./types";
import { COUNTRY_OPTIONS } from "./types";
import { matchProfileToJob } from "./matching";

function countryName(code: string): string {
  return COUNTRY_OPTIONS.find((c) => c.code === (code || "").toLowerCase())?.label || "";
}

// Rule-based fallback when ANTHROPIC_API_KEY is missing.
// Mirrors the Claude output structure (FINAL RESUME / WHY IT FITS /
// REMAINING GAPS / LAST-MINUTE IMPROVEMENTS) so the UI stays consistent.
// Claude path lives in /api/tailor-resume (server) so key never leaks.
export function localTailor(profile: UserProfile, job: Job): string {
  const m = matchProfileToJob(profile, job);
  const baseResume = (profile.resumeText || "").trim();
  const company = job.company || "Company";

  const gaps =
    m.missingSkills.length > 0
      ? m.missingSkills.slice(0, 5).join(", ")
      : "none major - profile covers the detected requirements";
  const improvements = lastMinuteImprovements(profile, job, m.matchedSkills);

  // When the user already has a resume, tailor THAT instead of inventing one:
  // keep their content verbatim and add a tailored header they can paste in.
  if (baseResume) {
    const out: string[] = [];
    out.push("### 1. FINAL RESUME");
    out.push(`(Tailored for ${job.title} @ ${company} - match ${m.score}/100)`);
    out.push("");
    out.push("TAILORED SUMMARY (paste at the top of your resume)");
    out.push(tailoredSummary(profile, job, m.matchedSkills));
    out.push("");
    out.push("SKILLS TO LEAD WITH FOR THIS JOB");
    out.push(orderedSkills(profile, m).join(", ") || profile.skills.join(", ") || "-");
    out.push("");
    out.push("YOUR ORIGINAL RESUME (unchanged - weave the keywords above into it)");
    out.push(baseResume.slice(0, 6000));
    out.push("");
    out.push(`### 2. WHY THIS RESUME FITS ${company.toUpperCase()}`);
    out.push(whyItFits(profile, job, m.matchedSkills));
    out.push("");
    out.push("### 3. REMAINING GAPS");
    out.push(gaps);
    out.push("");
    out.push("### 4. LAST-MINUTE IMPROVEMENTS");
    for (const imp of improvements) out.push(`- ${imp}`);
    return out.join("\n");
  }

  const lines: string[] = [];
  lines.push("### 1. FINAL RESUME");
  lines.push(`${profile.name || "Your Name"}`);
  const place = [profile.city, countryName(profile.country)].filter(Boolean).join(", ");
  const contact = [
    place || null,
    profile.phone ? `Phone: ${profile.phone}` : null,
  ].filter(Boolean).join(" | ");
  if (contact) lines.push(contact);
  const links = [
    profile.linkedinUrl?.trim() ? `LinkedIn: ${profile.linkedinUrl.trim()}` : null,
    profile.githubUrl?.trim() ? `GitHub: ${profile.githubUrl.trim()}` : null,
  ].filter(Boolean);
  if (links.length) lines.push(links.join("  |  "));
  const edu = profile.education;
  if (edu && (edu.degree || edu.college)) {
    lines.push("");
    lines.push("EDUCATION");
    if (edu.degree) lines.push(edu.degree);
    const second = [edu.college, edu.year].filter(Boolean).join("  /  ");
    if (second) lines.push(second);
  }
  lines.push("");
  lines.push("TECHNICAL SKILLS");
  lines.push(`Programming: ${orderedSkills(profile, m).join(", ") || "-"}`);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(tailoredSummary(profile, job, m.matchedSkills));
  if (profile.experience.length) {
    lines.push("");
    lines.push("LEADERSHIP EXPERIENCE");
    for (const e of profile.experience.slice(0, 3)) {
      lines.push(`${e.title || "Role"}  /  ${e.org || "Organization"}`);
      if (e.description) lines.push(`- ${e.description}`);
      const entryHay = `${e.title} ${e.org} ${e.description}`.toLowerCase();
      const relevant = m.matchedSkills
        .filter((s) => entryHay.includes(s.toLowerCase()))
        .slice(0, 3);
      if (relevant.length) lines.push(`- Relevance to "${job.title}": draws on ${relevant.join(", ")}.`);
    }
  }
  lines.push("");
  lines.push("PROJECTS");
  const projs = profile.projects.slice(0, 3);
  if (projs.length === 0) {
    lines.push("- (Add a project on your Profile page - tailored resumes need proof of work.)");
  }
  for (const p of projs) {
    const tech = p.techStack.join(", ");
    lines.push(`${p.title || "Untitled project"}`);
    if (p.description) lines.push(`- ${p.description}`);
    if (tech) lines.push(`- Built with ${tech}.`);
    lines.push(`- ${projectAngle(p.techStack, job, m.matchedSkills)}`);
    if (p.link) lines.push(`- Code: ${p.link}`);
  }
  lines.push("");
  lines.push(`### 2. WHY THIS RESUME FITS ${company.toUpperCase()}`);
  lines.push(whyItFits(profile, job, m.matchedSkills));
  lines.push("");
  lines.push("### 3. REMAINING GAPS");
  lines.push(gaps);
  lines.push("");
  lines.push("### 4. LAST-MINUTE IMPROVEMENTS");
  for (const imp of improvements) lines.push(`- ${imp}`);
  return lines.join("\n");
}

function whyItFits(profile: UserProfile, job: Job, matched: string[]): string {
  const parts: string[] = [];
  if (matched.length)
    parts.push(
      `Leads with your overlapping skills (${matched.slice(0, 4).join(", ")}) so both ATS and a 10-second recruiter skim see the fit instantly.`
    );
  const best = profile.projects.find((p) =>
    p.techStack.some((t) => matched.some((s) => s.toLowerCase() === t.toLowerCase()))
  );
  if (best)
    parts.push(
      `"${best.title}" is positioned as proof you can learn and contribute to ${job.title}-style work.`
    );
  else if (profile.projects[0])
    parts.push(
      `"${profile.projects[0].title}" is framed as transferable building experience for ${job.title}.`
    );
  parts.push(`Summary names the exact role (${job.title}) at ${job.company || "the company"}.`);
  return parts.join(" ");
}

/** Honest, no-padding prep steps derived from the actual gaps. */
function lastMinuteImprovements(
  profile: UserProfile,
  job: Job,
  matched: string[]
): string[] {
  const out: string[] = [];
  const missing = matchProfileToJob(profile, job).missingSkills;
  if (missing[0])
    out.push(
      `Spend 2-3 hours on "${missing[0]}" docs and add one tiny demo to a project - then it is truthfully on your resume.`
    );
  if (missing[1])
    out.push(
      `Skim "${missing[1]}" basics so you can speak to it in a screening call, and name it as "currently learning" in your cover letter.`
    );
  const proj = profile.projects[0];
  if (proj)
    out.push(
      `Add one measurable line to "${proj.title}" (users, speed, scope) - numbers survive the 10-second skim.`
    );
  out.push(
    `Fix your GitHub README for your best project: what it does, how to run it, one screenshot.`
  );
  if (matched.length)
    out.push(
      `Mirror 2-3 exact keywords from the posting (${matched.slice(0, 3).join(", ")}) in your summary - same words, honest claims.`
    );
  return out.slice(0, 5);
}

function tailoredSummary(profile: UserProfile, job: Job, matched: string[]): string {
  const top = matched.slice(0, 3).join(", ");
  const base =
    profile.summary ||
    `Fresher building with ${profile.skills.slice(0, 4).join(", ") || "modern web and data tools"}.`;
  return top
    ? `${base} Targeting ${job.title}: strongest overlap in ${top}.`
    : `${base} Targeting ${job.title}: bringing transferable skills and fast learning.`;
}

function orderedSkills(profile: UserProfile, m: ReturnType<typeof matchProfileToJob>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...m.matchedSkills, ...profile.skills]) {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out.slice(0, 15);
}

function projectAngle(techStack: string[], job: Job, matched: string[]): string {
  const tech = new Set(techStack.map((t) => t.toLowerCase()));
  const overlap = matched.filter((s) => tech.has(s.toLowerCase()));
  if (overlap.length)
    return `Why it fits "${job.title}": demonstrates ${overlap.slice(0, 4).join(", ")} from the job requirements.`;
  if (matched.length)
    return `Why it fits "${job.title}": transferable engineering from ${techStack.slice(0, 3).join(", ") || "this build"}; map it to ${matched.slice(0, 3).join(", ")} in interviews.`;
  return `Relevance: shows end-to-end building ability applicable to "${job.title}".`;
}

export const PROFILE_KEY = "fjf-profile-v1";

export function loadProfileLocal(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfileLocal(p: UserProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

// --- Generated-document history (per job, resumes + cover letters) ---------
export interface SavedDoc {
  id: string;
  kind: "resume" | "cover-letter";
  jobId: string;
  jobTitle: string;
  company: string;
  text: string;
  matchScore: number;
  engine: string;
  createdAt: string; // ISO
}

const HISTORY_KEY = "fjf-doc-history-v1";
const HISTORY_CAP = 30;

export function loadDocHistory(): SavedDoc[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as SavedDoc[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveDocEntry(e: Omit<SavedDoc, "id" | "createdAt">): SavedDoc {
  const entry: SavedDoc = {
    ...e,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  try {
    const next = [entry, ...loadDocHistory()].slice(0, HISTORY_CAP);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return entry;
}

export function deleteDocEntry(id: string): void {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(loadDocHistory().filter((d) => d.id !== id))
    );
  } catch {
    // ignore
  }
}

export function historyForJob(jobId: string, kind?: SavedDoc["kind"]): SavedDoc[] {
  return loadDocHistory().filter((d) => d.jobId === jobId && (!kind || d.kind === kind));
}

// --- Local cover-letter fallback (Claude path lives in /api/cover-letter) ---
export function localCoverLetter(profile: UserProfile, job: Job): string {
  const m = matchProfileToJob(profile, job);
  const name = profile.name || "Your Name";
  const top = m.matchedSkills.slice(0, 3).join(", ");
  const best = profile.projects[0];
  const lines: string[] = [];
  lines.push(`Dear ${job.company || "Hiring"} team,`);
  lines.push("");
  lines.push(
    `I am applying for the ${job.title} role${job.location ? ` in ${job.location}` : ""}. ` +
      (top
        ? `As a fresher building with ${top}, I match the core of what you are looking for.`
        : `As a fresher who learns fast and ships, I would love to grow into what you are looking for.`)
  );
  lines.push("");
  if (best) {
    lines.push(
      `Recently I built ${best.title}${best.techStack.length ? ` (${best.techStack.join(", ")})` : ""}` +
        (best.description ? ` - ${best.description}` : "") +
        (top ? ` This gave me hands-on practice with ${top}.` : "")
    );
    lines.push("");
  }
  if (m.missingSkills.length) {
    lines.push(
      `I am upfront about gaps: ${m.missingSkills.slice(0, 3).join(", ")}. ` +
        `I am already learning them through docs and a mini-project, and I would welcome proving that in a task round.`
    );
    lines.push("");
  }
  lines.push(
    `Thank you for considering a fresher for this role. I would love a short conversation about how I can contribute from week one.`
  );
  lines.push("");
  lines.push(`Best regards,`);
  lines.push(name);
  if (profile.email) lines.push(profile.email);
  const links = [profile.githubUrl?.trim(), profile.linkedinUrl?.trim()].filter(Boolean);
  if (links.length) lines.push(links.join(" | "));
  return lines.join("\n");
}
