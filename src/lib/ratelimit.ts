/**
 * Tiny in-memory rate limiter for the paid AI endpoints (tailor-resume,
 * cover-letter). Without this, anyone can burn ANTHROPIC_API_KEY once it is
 * set. Per-instance memory is fine for single-instance deploys; move to KV
 * (e.g. Vercel KV / Upstash) when scaling horizontally.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_HITS = 12; // generations per window per IP

const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "local";
}

export function rateLimited(req: Request): { limited: boolean; retryAfterSec: number } {
  const key = clientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const times = (hits.get(key) || []).filter((t) => t > windowStart);
  if (times.length >= MAX_HITS) {
    const retryAfterSec = Math.ceil((times[0] + WINDOW_MS - now) / 1000);
    return { limited: true, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  times.push(now);
  // Prevent unbounded growth across many IPs.
  if (hits.size > 2000) hits.clear();
  hits.set(key, times);
  return { limited: false, retryAfterSec: 0 };
}
