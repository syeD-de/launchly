import type { Job, UserProfile } from "./types";

// Country code -> location keywords used to check if a no-key job
// actually belongs to the requested market. Arbeitnow is EU-centric
// (mostly Berlin/Germany), so without this India users see Berlin jobs.
const COUNTRY_HINTS: Record<string, string[]> = {
  in: ["india", "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad", "chennai", "pune", "kolkata"],
  us: ["united states", "usa", "u.s.", "new york", "san francisco", "austin", "seattle", "boston", "chicago"],
  gb: ["united kingdom", "uk", "britain", "england", "london", "manchester", "birmingham"],
  ca: ["canada", "toronto", "vancouver", "montreal", "ottawa"],
  au: ["australia", "sydney", "melbourne", "brisbane", "perth"],
  de: ["germany", "deutschland", "berlin", "munich", "hamburg", "frankfurt", "köln", "cologne"],
  sg: ["singapore"],
  ae: ["uae", "united arab emirates", "dubai", "abu dhabi", "sharjah"],
};

function locationMatchesCountry(location: string, isRemoteJob: boolean, country: string, remoteOnly: boolean): boolean {
  const loc = location.toLowerCase();
  if (remoteOnly) return loc.includes("remote") || isRemoteJob;
  if (loc.includes("remote")) return true; // remote jobs are valid in any market
  const hints = COUNTRY_HINTS[country] || [];
  if (hints.length === 0) return true;
  return hints.some((h) => loc.includes(h));
}

// --- Description cleaning -------------------------------------------------
// Sources (esp. Arbeitnow) return double-escaped HTML like
// `&lt;h2 style=&quot;...` — a single tag-strip leaves raw entities on screen.
function decodeEntitiesOnce(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCharCode(parseInt(n, 10))
    );
}

/** Decode entities (repeatedly), strip tags, normalize whitespace. */
export function cleanJobText(raw: string, max = 2000): string {
  let s = repairMojibake(raw || "");
  for (let i = 0; i < 3; i++) {
    const d = decodeEntitiesOnce(s);
    if (d === s) break;
    s = d;
  }
  s = s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|ul|ol|section)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  s = decodeEntitiesOnce(s); // catch entities left behind inside stripped tags
  s = s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return s;
}

// --- Seniority + location honesty ------------------------------------------
const SENIOR_RE =
  /\b(senior|sr\.|staff|principal|lead|manager|director|head of|\bvp\b|vice president|cto|architect|[5-9]\+?\s*(yrs?|years)|10\+?\s*(yrs?|years))\b/i;
const FRESHER_OK_RE =
  /\b(intern(ship)?s?|junior|fresher|entry[\s-]?level|trainee|graduate|working student|apprentice|students?)\b/i;

/** Senior-level posting? Titles that also say intern/junior/fresher count as fresher-OK. */
export function seniorityOf(title: string, description: string): NonNullable<Job["seniority"]> {
  if (FRESHER_OK_RE.test(title)) return /\bintern(ship)?s?\b/i.test(title) ? "internship" : "entry";
  if (SENIOR_RE.test(`${title} ${description.slice(0, 500)}`)) return "senior";
  return "unknown";
}

/** Remove senior-level posts from fresher searches (unless the user asked for them). */
function preferFresherRoles<T extends { title: string; description: string }>(
  items: T[],
  userQuery: string
): T[] {
  // Only an explicit senior-flavored query disables the filter. Fresher words
  // like "intern" must NOT disable it — that is exactly when filtering matters.
  if (SENIOR_RE.test(userQuery || "")) return items;
  const filtered = items.filter(
    (j) => seniorityOf(j.title, j.description) !== "senior"
  );
  // Never nuke the whole pool — a flagged senior role with a warning
  // beats an empty page or a fake mock.
  return filtered.length ? filtered : items;
}

/** Repair UTF-8 bytes misdecoded as latin1. Built from char codes so the
 *  source file stays pure ASCII (no literal control chars to get mangled). */
const C = (n: number) => String.fromCharCode(n);
const MOJIBAKE_FIXES: [string, string][] = [
  [C(0xe2) + C(0x80) + C(0x93), C(0x2013)],
  [C(0xe2) + C(0x80) + C(0x94), C(0x2014)],
  [C(0xe2) + C(0x80) + C(0x98), "'"],
  [C(0xe2) + C(0x80) + C(0x99), "'"],
  [C(0xe2) + C(0x80) + C(0x9c), '"'],
  [C(0xe2) + C(0x80) + C(0x9d), '"'],
  [C(0xe2) + C(0x80) + C(0xa6), C(0x2026)],
  [C(0xc3) + C(0xbc), C(0xfc)],
  [C(0xc3) + C(0xb6), C(0xf6)],
  [C(0xc3) + C(0xa4), C(0xe4)],
  [C(0xc3) + C(0x9c), C(0xdc)],
  [C(0xc3) + C(0x96), C(0xd6)],
  [C(0xc3) + C(0x84), C(0xc4)],
  [C(0xc3) + C(0x9f), C(0xdf)],
  [C(0xc3) + C(0xa9), C(0xe9)],
  [C(0xc3) + C(0xa8), C(0xe8)],
];

function repairMojibake(s: string): string {
  if (!/[\u0080-\u00e3]/.test(s)) return s;
  let out = s;
  for (const [bad, good] of MOJIBAKE_FIXES) {
    if (out.includes(bad)) out = out.split(bad).join(good);
  }
  if (out !== s && !/[\u0080-\u009f]/.test(out)) return out;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    const FFFD = String.fromCharCode(0xfffd);
    if (!fixed.includes(FFFD) && out !== fixed) return fixed;
  } catch {
    // keep going
  }
  // Last resort: never leak control-char boxes to the UI.
  const CTRLS = new RegExp("[\\u0080-\\u009f\\ufffd]+", "g");
  return out.replace(CTRLS, "-");
}

/** Titles/companies/locations need the same entity + mojibake cleanup as descriptions. */
function cleanShort(raw: string): string {
  let s = repairMojibake(raw || "");
  for (let i = 0; i < 3; i++) {
    const d = decodeEntitiesOnce(s);
    if (d === s) break;
    s = d;
  }
  s = s.replace(/<[^>]+>/g, "").replace(CTRLS, "-").replace(/\s{2,}/g, " ").trim();
  return decodeEntitiesOnce(s);
}

const CTRLS = new RegExp("[\\u0080-\\u009f\\ufffd]+", "g");

/** Tidy "Berlin, Berlin" -> "Berlin"; detect remote/hybrid for badges. */
export function normalizeJobLocation(
  rawLocation: string,
  isRemoteFlag: boolean
): { location: string; workMode: NonNullable<Job["workMode"]> } {
  const raw = cleanShort(rawLocation) || "Remote";
  const lower = raw.toLowerCase();
  const remote = isRemoteFlag || lower.includes("remote");
  const hybrid = lower.includes("hybrid");
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const deduped = parts.filter(
    (p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i
  );
  return {
    location: deduped.join(", ") || raw,
    workMode: hybrid ? "hybrid" : remote ? "remote" : lower === "remote" ? "remote" : "onsite",
  };
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function strOrUndefined(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return s ? s : undefined;
}

function isoOrUndefined(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) {
    // unix seconds (Arbeitnow) vs ms
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

const COUNTRY_CURRENCY: Record<string, string> = {
  in: "INR",
  us: "USD",
  gb: "GBP",
  ca: "CAD",
  au: "AUD",
  de: "EUR",
  sg: "SGD",
  ae: "AED",
};

function currencyFor(country: string): string | undefined {
  return COUNTRY_CURRENCY[country.toLowerCase()];
}

function adzunaKeywords(profile: UserProfile, override?: string) {
  const base =
    override?.trim() ||
    [
      ...profile.skills.slice(0, 4),
      profile.jobType === "both" ? "intern fresher" : profile.jobType,
    ]
      .join(" ")
      .trim();
  return base || "software intern fresher";
}

// Server-side job fetcher: Adzuna (needs keys, dynamic country) -> Remotive/Arbeitnow (no key) -> mock
export interface JobSearchResult {
  jobs: Job[];
  source: string;
  /** True when nothing matched the query and we broadened to the whole market. */
  broadFallback?: boolean;
  /** True when another page of results likely exists (Adzuna / deep pools). */
  hasMore?: boolean;
}
const FETCH_TIMEOUT_MS = 12000;

function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

// Tiny in-process cache for the heavy no-key payload (arbeitnow is ~3MB and
// Next's fetch cache refuses entries over 2MB — without this, every search
// re-downloads megabytes). Per-instance memory; fine until horizontal scale.
const upstreamCache = new Map<string, { at: number; data: unknown }>();
const UPSTREAM_TTL_MS = 10 * 60 * 1000;

async function cachedJson(url: string, init?: RequestInit): Promise<unknown> {
  const hit = upstreamCache.get(url);
  if (hit && Date.now() - hit.at < UPSTREAM_TTL_MS) return hit.data;
  const res = await timedFetch(url, init);
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data: unknown = await res.json();
  if (upstreamCache.size > 20) upstreamCache.clear();
  upstreamCache.set(url, { at: Date.now(), data });
  return data;
}
export async function fetchJobsForProfile(
  profile: Pick<UserProfile, "country" | "city" | "remoteOnly" | "jobType" | "skills"> & { query?: string; page?: number }
): Promise<JobSearchResult> {
  const country = (profile.country || "in").toLowerCase();
  const page = Math.max(1, Math.min(5, Math.floor(profile.page || 1)));
  const query = adzunaKeywords(
    { skills: profile.skills, jobType: profile.jobType } as UserProfile,
    profile.query
  );

  // 1) Adzuna if keys exist — country targeted per user
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (appId && appKey) {
    try {
      const where = profile.remoteOnly ? "remote" : profile.city || "";
      const url =
        `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}` +
        `?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}` +
        `&results_per_page=20&what=${encodeURIComponent(query)}` +
        (where ? `&where=${encodeURIComponent(where)}` : "") +
        `&sort_by=date&max_days_old=30`;
      const res = await timedFetch(url, { next: { revalidate: 600 } });
      if (res.ok) {
        const data = await res.json();
        const raw: Job[] = (data.results || []).map((r: Record<string, unknown>) => {
          const title = cleanShort(String((r as { title?: unknown }).title ?? "Untitled"));
          const description = cleanJobText(String((r as { description?: unknown }).description ?? ""));
          const { location, workMode } = normalizeJobLocation(
            String(((r as { location?: { display_name?: unknown } }).location?.display_name) ?? ""),
            false
          );
          const salaryMin = numOrNull((r as { salary_min?: unknown }).salary_min);
          const salaryMax = numOrNull((r as { salary_max?: unknown }).salary_max);
          return {
            id: `adzuna-${String((r as { id?: unknown }).id ?? Math.random())}`,
            title,
            company: cleanShort(String(
              ((r as { company?: { display_name?: unknown } }).company?.display_name) ?? ""
            )),
            location,
            country,
            description,
            url: String((r as { redirect_url?: unknown }).redirect_url ?? ""),
            tags: Array.isArray((r as { category?: { label?: unknown } }).category?.label)
              ? []
              : [String(((r as { category?: { label?: unknown } }).category?.label ?? "")).toLowerCase()].filter(Boolean),
            source: "adzuna",
            workMode,
            seniority: seniorityOf(title, description),
            salaryMin,
            salaryMax,
            salaryCurrency: salaryMin != null || salaryMax != null ? currencyFor(country) : undefined,
            salaryPredicted: Boolean((r as { salary_is_predicted?: unknown }).salary_is_predicted) || undefined,
            postedAt: isoOrUndefined((r as { created?: unknown }).created),
            contractType: strOrUndefined((r as { contract_time?: unknown }).contract_time),
          } satisfies Job;
        });
        const jobs = preferFresherRoles(raw, profile.query || "");
        if (jobs.length) return { jobs, source: `adzuna:${country}`, hasMore: jobs.length === 20 && page < 5 };
      }
    } catch {
      // fall through
    }
  }

  // 2) Remote APIs (no key) when remoteOnly or as supplement
  if (profile.remoteOnly) {
    try {
      const res = await timedFetch("https://remoteok.com/api?tag=software", {
        headers: { "User-Agent": "launchly/1.0" },
        next: { revalidate: 600 },
      });
      if (res.ok) {
        const data = await res.json();
        const raw: Job[] = (Array.isArray(data) ? data.slice(1, 21) : []).map(
          (r: Record<string, unknown>) => {
            const title = cleanShort(String((r as { position?: unknown }).position ?? "Remote role"));
            const description = cleanJobText(String((r as { description?: unknown }).description ?? ""));
            return {
              id: `remoteok-${String((r as { id?: unknown }).id ?? Math.random())}`,
              title,
              company: cleanShort(String((r as { company?: unknown }).company ?? "")),
              location: "Remote",
              country,
              description,
              url: String((r as { url?: unknown }).url ?? (r as { apply_url?: unknown }).apply_url ?? ""),
              tags: Array.isArray((r as { tags?: unknown }).tags)
                ? ((r as { tags?: unknown[] }).tags as unknown[]).map(String).slice(0, 8)
                : [],
              source: "remoteok",
              workMode: "remote" as const,
              seniority: seniorityOf(title, description),
              postedAt: isoOrUndefined((r as { date?: unknown }).date),
            } satisfies Job;
          }
        );
        const jobs = preferFresherRoles(raw, profile.query || "");
        if (jobs.length) return { jobs, source: "remoteok" };
      }
    } catch {
      // fall through
    }
  }

  // 3) Arbeitnow (no key, mostly Germany/EU) — filter by query AND requested country.
  // Without the country check, India users see Berlin jobs mislabeled as India.
  try {
    const data = (await cachedJson("https://www.arbeitnow.com/api/job-board-api", {
      next: { revalidate: 600 },
    })) as { data?: Record<string, unknown>[] };
    {
      const q = query.toLowerCase().split(/\s+/);
      const all = (data.data || []) as Record<string, unknown>[];
      const queryFiltered = all.filter((j) => {
        const hay = `${String(j.title ?? "")} ${String(j.description ?? "")} ${(Array.isArray(j.tags) ? (j.tags as unknown[]).join(" ") : "")}`.toLowerCase();
        return q.some((t) => t.length > 2 && hay.includes(t));
      });
      const pool = queryFiltered.length ? queryFiltered : all;
      const broadFallback = queryFiltered.length === 0;
      const marketFiltered = pool.filter((j) =>
        locationMatchesCountry(
          String(j.location ?? "Remote"),
          Boolean(j.remote),
          country,
          profile.remoteOnly
        )
      );
      // If nothing in this market matches, fall through to mock (which is
      // generated for the requested country) instead of showing Berlin as India.
      if (marketFiltered.length === 0) throw new Error("no-jobs-in-market");
      const windowed = marketFiltered.slice(0, 20 * page);
      const cleaned: Job[] = windowed.map((j) => {
        const title = cleanShort(String(j.title ?? "Untitled"));
        const description = cleanJobText(String(j.description ?? ""));
        const { location, workMode } = normalizeJobLocation(
          String(j.location ?? "Remote"),
          Boolean(j.remote)
        );
        return {
          id: `arbeitnow-${String(j.slug ?? Math.random())}`,
          title,
          company: cleanShort(String(j.company_name ?? "")),
          location,
          country,
          description,
          url: String(j.url ?? ""),
          tags: Array.isArray(j.tags) ? (j.tags as unknown[]).map(String).slice(0, 8) : [],
          source: "arbeitnow",
          workMode,
          seniority: seniorityOf(title, description),
          postedAt: isoOrUndefined(j.created_at),
        } satisfies Job;
      });
      const jobs = preferFresherRoles(cleaned, profile.query || "").slice(0, 20 * page);
      if (jobs.length)
        return {
          jobs,
          source: `arbeitnow (filtered to ${country})`,
          broadFallback,
          hasMore: marketFiltered.length > 20 * page,
        };
    }
  } catch {
    // fall through
  }

  // 4) Mock fresher jobs so UI works with zero keys
  const skill = profile.skills[0] || "React";
  const city = profile.city || (country === "in" ? "Bengaluru" : "Remote");
  const nowIso = new Date().toISOString();
  const mock: Job[] = [
    {
      id: "mock-1",
      title: `Frontend Intern (${skill})`,
      company: "Startup Labs",
      location: profile.remoteOnly ? "Remote" : city,
      country,
      description: `Great for freshers. Requires ${skill}, HTML, CSS, Git. Build UI components, fix bugs, ship with mentors. Plus: REST APIs, Tailwind.`,
      url: "",
      tags: [skill.toLowerCase(), "html", "css", "git", "rest"],
      source: "mock",
      workMode: profile.remoteOnly ? "remote" : "onsite",
      seniority: "internship",
      postedAt: nowIso,
    },
    {
      id: "mock-2",
      title: "Software Engineering Intern",
      company: "CloudKaro",
      location: profile.remoteOnly ? "Remote" : city,
      country,
      description: `Fresher-friendly backend + frontend. Requires javascript, node, sql. Nice: docker, aws, testing.`,
      url: "",
      tags: ["javascript", "node", "sql", "docker"],
      source: "mock",
      workMode: profile.remoteOnly ? "remote" : "onsite",
      seniority: "internship",
      postedAt: nowIso,
    },
    {
      id: "mock-3",
      title: "Data / ML Intern (Fresher)",
      company: "Insightful",
      location: profile.remoteOnly ? "Remote" : city,
      country,
      description: `Entry role for students. Requires python, pandas, sql. Nice: machine learning, excel, power bi.`,
      url: "",
      tags: ["python", "pandas", "sql", "machine learning"],
      source: "mock",
      workMode: profile.remoteOnly ? "remote" : "onsite",
      seniority: "internship",
      postedAt: nowIso,
    },
  ];
  return { jobs: mock, source: "mock (add ADZUNA_APP_ID/KEY for live)" };
}
