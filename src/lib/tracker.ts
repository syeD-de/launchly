import type { Job } from "./types";

export type AppStatus = "saved" | "applied" | "interview" | "rejected" | "offer";

export const STATUS_LABEL: Record<AppStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  rejected: "Rejected",
  offer: "Offer",
};

export const STATUS_ORDER: AppStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

export interface TrackedJob {
  job: Job;
  status: AppStatus;
  updatedAt: string; // ISO
}

const BOOKMARKS_KEY = "fjf-bookmarks-v1"; // string[] of job ids
const TRACKED_KEY = "fjf-tracked-v1"; // Record<id, TrackedJob>

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (private mode / quota)
  }
}

// --- Bookmarks (quick "look later" list) ---
export function loadBookmarks(): string[] {
  const v = read<string[]>(BOOKMARKS_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function isBookmarked(id: string): boolean {
  return loadBookmarks().includes(id);
}

/** Toggle; returns the new bookmarked state. */
export function toggleBookmark(id: string): boolean {
  const cur = loadBookmarks();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  write(BOOKMARKS_KEY, next);
  return next.includes(id);
}

// --- Application pipeline (status + job snapshot so it renders standalone) ---
export function loadTracked(): Record<string, TrackedJob> {
  const v = read<Record<string, TrackedJob>>(TRACKED_KEY, {});
  return v && typeof v === "object" ? v : {};
}

export function getStatus(id: string): AppStatus | null {
  return loadTracked()[id]?.status ?? null;
}

export function setJobStatus(job: Job, status: AppStatus): void {
  const cur = loadTracked();
  // Same role from another source (different id) shouldn't double up the pipeline.
  const key = `${job.company}`.toLowerCase().trim() + "|" + job.title.toLowerCase().trim();
  for (const [id, t] of Object.entries(cur)) {
    if (id !== job.id) {
      const k = `${t.job.company}`.toLowerCase().trim() + "|" + t.job.title.toLowerCase().trim();
      if (k === key) delete cur[id];
    }
  }
  cur[job.id] = { job, status, updatedAt: new Date().toISOString() };
  write(TRACKED_KEY, cur);
}

export function removeTracked(id: string): void {
  const cur = loadTracked();
  delete cur[id];
  write(TRACKED_KEY, cur);
}

export function pipelineCounts(): Record<AppStatus, number> {
  const all = Object.values(loadTracked());
  const counts: Record<AppStatus, number> = {
    saved: 0,
    applied: 0,
    interview: 0,
    rejected: 0,
    offer: 0,
  };
  for (const t of all) counts[t.status] += 1;
  return counts;
}

// --- Hidden jobs ("not interested") ------------------------------------------
const HIDDEN_KEY = "fjf-hidden-v1";

export function loadHidden(): string[] {
  const v = read<string[]>(HIDDEN_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function hideJob(id: string): void {
  const cur = loadHidden();
  if (!cur.includes(id)) write(HIDDEN_KEY, [...cur, id].slice(-300));
}

export function unhideJob(id: string): void {
  write(HIDDEN_KEY, loadHidden().filter((x) => x !== id));
}

export function clearHidden(): void {
  write(HIDDEN_KEY, []);
}

/** Refresh frozen job snapshots with fresh listings (status is preserved). */
export function refreshTrackedSnapshots(jobs: Job[]): void {
  if (!jobs.length) return;
  const cur = loadTracked();
  const byId = new Map(jobs.map((j) => [j.id, j]));
  let changed = false;
  for (const [id, t] of Object.entries(cur)) {
    const fresh = byId.get(id);
    if (fresh) {
      cur[id] = { ...t, job: fresh };
      changed = true;
    }
  }
  if (changed) write(TRACKED_KEY, cur);
}

// --- "New since last visit" pulse -------------------------------------------
const SEEN_KEY = "fjf-seen-ids-v1";
const SEEN_CAP = 500;

/**
 * How many of these ids have never been seen before (records them).
 * First run records silently and returns 0 so the pulse isn't noisy.
 */
export function countNewIds(ids: string[]): number {
  const seen = read<string[]>(SEEN_KEY, []);
  const set = new Set(Array.isArray(seen) ? seen : []);
  if (set.size === 0 && ids.length > 0) {
    write(SEEN_KEY, ids.slice(0, SEEN_CAP));
    return 0;
  }
  let fresh = 0;
  for (const id of ids) {
    if (!set.has(id)) {
      set.add(id);
      fresh += 1;
    }
  }
  write(SEEN_KEY, [...set].slice(-SEEN_CAP));
  return fresh;
}
