import type { UserProfile } from "./types";

/** Real completeness score from actual profile data (not hard-coded). */
export function profileStrength(p: UserProfile): { score: number; tips: string[] } {
  let pts = 0;
  const tips: string[] = [];

  if (p.name.trim()) pts += 10; else tips.push("Add your name so resumes look complete.");
  if (p.email.trim()) pts += 10; else tips.push("Add your email for applications.");
  if (p.country) pts += 5;
  if (p.city.trim() || p.remoteOnly) pts += 5; else tips.push("Set a city or enable Remote to target jobs.");
  if (p.skills.length >= 5) pts += 20;
  else if (p.skills.length >= 3) { pts += 14; tips.push("Add 2+ more skills — 5+ gives far better matches."); }
  else if (p.skills.length > 0) { pts += 8; tips.push("Add more skills — aim for at least 5."); }
  else { tips.push("Add your skills — matching can't work without them."); }

  if (p.summary.trim().length >= 120) pts += 15;
  else if (p.summary.trim().length >= 40) { pts += 9; tips.push("Expand your summary to 2–3 lines about what you build."); }
  else { tips.push("Write a short summary of what you can build."); }

  const goodProjects = p.projects.filter((x) => x.title.trim() && x.techStack.length > 0);
  if (goodProjects.length >= 2) pts += 25;
  else if (goodProjects.length === 1) { pts += 15; tips.push("Add a second project with tech stack to unlock more matches."); }
  else { tips.push("Add your projects with tech stacks to make matches accurate."); }

  if (p.experience.length > 0) pts += 10;
  else tips.push("Add any internship, freelance, or club experience (optional but helps).");

  return { score: Math.max(0, Math.min(100, pts)), tips: tips.slice(0, 3) };
}

/** Suggest next skill to learn from real missing-skill frequency. */
export function topMissingSkills(
  ranked: { match: { missingSkills: string[]; score: number } }[],
  own: string[],
  limit = 3
): string[] {
  const ownSet = new Set(own.map((s) => s.toLowerCase()));
  const freq = new Map<string, number>();
  for (const r of ranked.slice(0, 12)) {
    for (const m of r.match.missingSkills) {
      const k = m.toLowerCase();
      if (!ownSet.has(k)) freq.set(m, (freq.get(m) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([skill]) => skill);
}
