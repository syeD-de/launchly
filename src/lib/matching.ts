import type { Job, MatchResult, UserProfile } from "./types";

const STOP = new Set([
  "and", "the", "for", "with", "our", "you", "your", "are", "will", "have",
  "has", "from", "this", "that", "role", "team", "work", "who", "what",
  "into", "plus", "etc", "per", "year", "years", "new", "all", "any",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function norm(s: string) {
  return s.toLowerCase().trim();
}

// Canonical skill key so variants match: "Next.js" <-> "nextjs",
// "Node.js" <-> "node", "PostgreSQL" <-> "postgres", "ML" <-> "machine learning".
function canon(s: string): string {
  const n = s.toLowerCase().trim();
  if (n === "c++" || n === "c#") return n;
  const flat = n.replace(/[^a-z0-9]/g, "");
  const ALIAS: Record<string, string> = {
    nodejs: "node",
    reactjs: "react",
    vuejs: "vue",
    nextjs: "nextjs",
    expressjs: "express",
    postgresql: "postgres",
    ml: "machine learning",
    powerbi: "power bi",
    tailwindcss: "tailwind",
    scikitlearn: "scikit-learn",
  };
  return ALIAS[flat] || (flat.length >= 3 ? flat : n);
}

// Source tags like "Engineering" / "Full-time" are categories, not skills —
// letting them into the skill set pollutes matching + ATS coverage.
const GENERIC_TAGS = new Set([
  "engineering",
  "technology",
  "software",
  "it",
  "other",
  "general",
  "full-time",
  "full time",
  "part-time",
  "part time",
  "contract",
  "permanent",
  "temporary",
  "remote",
  "on-site",
  "onsite",
  "hybrid",
  "internship",
  "entry level",
]);

// Extract likely required skills from job text: match against known vocab + tags
const SKILL_VOCAB = [
  "javascript", "typescript", "react", "next.js", "nextjs", "node", "node.js",
  "python", "java", "c++", "c#", "go", "rust", "php", "ruby", "swift",
  "kotlin", "html", "css", "tailwind", "vue", "angular", "express",
  "django", "flask", "fastapi", "spring", "sql", "postgres", "mysql",
  "mongodb", "redis", "firebase", "aws", "azure", "gcp", "docker",
  "kubernetes", "git", "figma", "tensorflow", "pytorch", "pandas",
  "excel", "power bi", "tableau", "rest", "graphql", "ml", "ai",
  "data analysis", "machine learning", "ui", "ux", "testing", "jest",
  "cypress", "linux",
];

export function extractJobSkills(job: Job): string[] {
  const hay = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  const found = new Set<string>();
  for (const v of SKILL_VOCAB) {
    // Word-boundary matching for every entry: plain includes() finds "java"
    // inside "javascript", "ml" inside "html", and "go" inside "django".
    // (+ and # stay inside tokens so "c++"/"c#" still match literally.)
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9+#])${esc}([^a-z0-9+#]|$)`).test(hay)) found.add(v);
  }
  for (const t of job.tags) {
    const n = t.toLowerCase().trim();
    if (n.length > 1 && !GENERIC_TAGS.has(n)) found.add(n);
  }
  return [...found].slice(0, 20);
}

/**
 * Core matching: user skills + project tech + experience text vs job requirements.
 * Weighted: skills 55%, projects 30%, experience/title 15%
 */
export function matchProfileToJob(profile: UserProfile, job: Job): MatchResult {
  const jobSkills = extractJobSkills(job);
  const userSkills = new Set(profile.skills.map(canon));
  const projectTech = new Set(
    profile.projects.flatMap((p) => p.techStack.map(canon))
  );
  const expText = norm(
    profile.experience.map((e) => `${e.title} ${e.org} ${e.description}`).join(" ")
  );

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const js of jobSkills) {
    const c = canon(js);
    if (userSkills.has(c) || projectTech.has(c)) matchedSkills.push(js);
    else missingSkills.push(js);
  }

  const projectHits: string[] = [];
  for (const p of profile.projects) {
    const pTech = p.techStack.map(canon);
    const hit = jobSkills.some((js) => pTech.includes(canon(js)));
    const titleHit = tokens(job.title + " " + job.description).some((t) =>
      norm(p.title + " " + p.description).includes(t)
    );
    if (hit || titleHit) projectHits.push(p.title);
  }

  const skillScore =
    jobSkills.length === 0 ? 60 : (matchedSkills.length / jobSkills.length) * 100;
  const projectScore =
    profile.projects.length === 0
      ? 40
      : Math.min(100, (projectHits.length / Math.max(1, profile.projects.length)) * 100 + (matchedSkills.length > 0 ? 20 : 0));
  const expTokens = tokens(expText);
  const jobTokens = tokens(job.title + " " + job.description);
  const overlap = jobTokens.filter((t) => expText.includes(t)).length;
  const expScore =
    expTokens.length === 0
      ? 50
      : Math.min(100, (overlap / Math.max(1, jobTokens.length)) * 300 + 30);

  const score = Math.round(skillScore * 0.55 + projectScore * 0.3 + expScore * 0.15);

  const reasons: string[] = [];
  if (matchedSkills.length > 0)
    reasons.push(`Matches your skills: ${matchedSkills.slice(0, 5).join(", ")}`);
  if (projectHits.length > 0)
    reasons.push(`Relevant project${projectHits.length > 1 ? "s" : ""}: ${projectHits.slice(0, 3).join(", ")}`);
  if (missingSkills.length > 0)
    reasons.push(`Missing / learn next: ${missingSkills.slice(0, 5).join(", ")}`);
  if (matchedSkills.length === 0 && projectHits.length === 0)
    reasons.push("Low overlap — tailor resume with transferable skills or add a small project.");

  return {
    score: Math.max(0, Math.min(100, score)),
    matchedSkills,
    missingSkills,
    projectHits,
    reasons,
    breakdown: {
      skills: Math.round(Math.max(0, Math.min(100, skillScore))),
      projects: Math.round(Math.max(0, Math.min(100, projectScore))),
      experience: Math.round(Math.max(0, Math.min(100, expScore))),
    },
  };
}
