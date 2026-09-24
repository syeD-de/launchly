export type JobType = "internship" | "entry" | "both";

export interface UserProfile {
  name: string;
  email: string;
  country: string; // adzuna code: in, us, gb...
  city: string;
  remoteOnly: boolean;
  workMode?: "remote" | "onsite" | "hybrid";
  jobType: JobType;
  skills: string[]; // e.g. ["React", "Python"]
  summary: string;
  githubUrl?: string;
  linkedinUrl?: string;
  /** User's existing resume (pasted or uploaded). Used as the base for tailoring. */
  resumeText?: string;
  projects: {
    title: string;
    description: string;
    techStack: string[];
    link?: string;
    demoUrl?: string;
  }[];
  experience: {
    title: string;
    org: string;
    description: string;
  }[];
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string;
  description: string;
  url: string;
  tags: string[];
  source: string;
  /** On-site / remote / hybrid as reported by the source (if known). */
  workMode?: "remote" | "onsite" | "hybrid" | "unknown";
  /** Rough seniority bucket so fresher UI can warn on senior roles. */
  seniority?: "internship" | "entry" | "senior" | "unknown";
  /** Annual pay range in local currency when the source reports it (Adzuna). */
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  /** True when the pay figure is the source's estimate, not the employer's. */
  salaryPredicted?: boolean;
  /** ISO timestamp of when the posting was published (when known). */
  postedAt?: string;
  /** e.g. "full_time", "part_time", "contract" (when known). */
  contractType?: string;
}

export interface MatchResult {
  score: number; // 0-100
  matchedSkills: string[];
  missingSkills: string[];
  projectHits: string[];
  reasons: string[];
  breakdown?: { skills: number; projects: number; experience: number };
}

export const EMPTY_PROFILE: UserProfile = {
  name: "",
  email: "",
  country: "in",
  city: "",
  remoteOnly: false,
  jobType: "internship",
  skills: [],
  summary: "",
  projects: [],
  experience: [],
};

export const COUNTRY_OPTIONS = [
  { code: "in", label: "India" },
  { code: "us", label: "USA" },
  { code: "gb", label: "UK" },
  { code: "ca", label: "Canada" },
  { code: "au", label: "Australia" },
  { code: "de", label: "Germany" },
  { code: "sg", label: "Singapore" },
  { code: "ae", label: "UAE" },
];
