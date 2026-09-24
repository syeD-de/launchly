import type { Job } from "./types";

/** "₹40K–₹60K /yr" — null when the source reports no pay. Adzuna pay is annual.
 *  Predicted (estimated) figures get a "~" prefix so nobody mistakes them
 *  for an employer's offer. */
export function formatSalary(job: Job): string | null {
  const { salaryMin, salaryMax, salaryCurrency, salaryPredicted } = job;
  if (salaryMin == null && salaryMax == null) return null;
  const currency = salaryCurrency || "USD";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      notation: "compact",
    }).format(n);
  const approx = salaryPredicted ? "~" : "";
  if (salaryMin != null && salaryMax != null) {
    if (salaryMin === salaryMax) return `${approx}${fmt(salaryMin)} /yr`;
    return `${approx}${fmt(salaryMin)}–${fmt(salaryMax)} /yr`;
  }
  const v = (salaryMin ?? salaryMax) as number;
  return `${approx}${fmt(v)}+ /yr`;
}

/** "just now" | "5h ago" | "yesterday" | "3d ago" — null when unknown. */
export function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
