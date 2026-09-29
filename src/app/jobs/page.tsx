"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, EmptyState, JobCardSkeleton, Kicker, MatchBadge } from "@/components/ui";
import { matchProfileToJob } from "@/lib/matching";
import { loadProfileLocal } from "@/lib/resume";
import { formatSalary, timeAgo } from "@/lib/format";
import {
  STATUS_LABEL,
  clearHidden,
  countNewIds,
  getStatus,
  hideJob,
  isBookmarked,
  loadBookmarks,
  loadHidden,
  loadTracked,
  refreshTrackedSnapshots,
  setJobStatus,
  toggleBookmark,
  unhideJob,
  type AppStatus,
} from "@/lib/tracker";
import { EMPTY_PROFILE, COUNTRY_OPTIONS, type Job, type UserProfile } from "@/lib/types";

function jobKind(job: Job): string {
  if (job.seniority === "senior") return "Senior-level ⚠";
  if (job.seniority === "internship") return "Internship";
  if (job.seniority === "entry") return "Entry-level";
  const hay = `${job.title} ${job.description}`;
  if (/intern/i.test(hay)) return "Internship";
  if (/junior|entry|fresher|graduate|trainee/i.test(hay)) return "Entry-level";
  return "Full-time";
}

function workModeLabel(job: Job): string | null {
  if (job.workMode === "remote") return "🌐 Remote";
  if (job.workMode === "hybrid") return "🔀 Hybrid";
  if (job.workMode === "onsite") return "🏢 On-site";
  return null;
}

type SortMode = "match" | "newest";

export default function JobsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [hasProfile, setHasProfile] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [source, setSource] = useState("");
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("in");
  const [city, setCity] = useState("");
  const [remote, setRemote] = useState(false);
  const [sort, setSort] = useState<SortMode>("match");
  const [savedOnly, setSavedOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AppStatus>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [broad, setBroad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // Guards out-of-order responses when filters change quickly.
  const reqId = useRef(0);

  useEffect(() => {
    const p = loadProfileLocal();
    if (p) {
      // Any saved profile can search — even with no skills yet (results just score lower).
      const merged = { ...EMPTY_PROFILE, ...p };
      setProfile(merged);
      setMarket(merged.country || "in");
      setCity(merged.city || "");
      setRemote(!!merged.remoteOnly);
      setHasProfile(true);
      setBookmarks(loadBookmarks());
      setHidden(loadHidden());
      refreshStatuses();
      void run(merged, "", merged.country || "in", merged.city || "", !!merged.remoteOnly, 1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshStatuses() {
    const tracked = loadTracked();
    const map: Record<string, AppStatus> = {};
    for (const [id, t] of Object.entries(tracked)) map[id] = t.status;
    setStatuses(map);
  }

  async function run(p: UserProfile, q: string, marketOverride?: string, cityOverride?: string, remoteOverride?: boolean, pageNum = 1, append = false) {
    const searchCountry = marketOverride ?? market ?? p.country ?? "in";
    const searchCity = cityOverride ?? city ?? "";
    const searchRemote = remoteOverride ?? remote ?? false;
    const my = ++reqId.current;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setBroad(false);
    }
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: searchCountry,
          city: searchRemote ? "" : searchCity,
          remoteOnly: searchRemote,
          jobType: p.jobType,
          skills: p.skills,
          query: q,
          page: pageNum,
        }),
      });
      if (!res.ok) throw new Error(`jobs ${res.status}`);
      const data = await res.json();
      if (reqId.current !== my) return; // a newer search owns the UI now
      const list: Job[] = data.jobs || [];
      setHasMore(!!data.hasMore);
      setBroad(!!data.broadFallback && q.trim().length > 0);
      setPage(pageNum);
      if (append) {
        setJobs((prev) => {
          const seen = new Set(prev.map((j) => j.id));
          return [...prev, ...list.filter((j) => !seen.has(j.id))];
        });
      } else {
        setJobs(list);
      }
      setSource(data.source || "");
      refreshTrackedSnapshots(list);
      countNewIds(list.map((j) => j.id)); // browsing marks listings as seen
      try {
        localStorage.setItem("fjf-jobs-cache", JSON.stringify(list));
      } catch {
        // ignore
      }
    } catch (e) {
      if (reqId.current !== my) return;
      console.error(e);
      setError("Something went wrong while finding jobs. Please try again.");
    } finally {
      if (reqId.current === my) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  const ranked = useMemo(() => {
    const list = jobs.map((j) => ({ job: j, match: matchProfileToJob(profile, j) }));
    if (sort === "newest") {
      list.sort(
        (a, b) =>
          (b.job.postedAt ? new Date(b.job.postedAt).getTime() : 0) -
          (a.job.postedAt ? new Date(a.job.postedAt).getTime() : 0)
      );
    } else {
      list.sort((a, b) => b.match.score - a.match.score);
    }
    return list;
  }, [jobs, profile, sort]);

  const visible = useMemo(() => {
    const notHidden = ranked.filter(({ job }) => !hidden.includes(job.id));
    if (!savedOnly) return notHidden;
    return notHidden.filter(
      ({ job }) => bookmarks.includes(job.id) || statuses[job.id]
    );
  }, [ranked, savedOnly, bookmarks, statuses, hidden]);

  function viewJob(job: Job) {
    try {
      localStorage.setItem("fjf-selected-job", JSON.stringify(job));
    } catch {
      // ignore
    }
    const params = new URLSearchParams({ market, q: query });
    router.push(`/jobs/${encodeURIComponent(job.id)}?${params.toString()}`);
  }

  function onToggleBookmark(job: Job) {
    const nowSaved = toggleBookmark(job.id);
    setBookmarks(loadBookmarks());
    if (nowSaved && !getStatus(job.id)) setJobStatus(job, "saved");
    refreshStatuses();
  }

  function onHide(job: Job) {
    hideJob(job.id);
    setHidden(loadHidden());
  }

  function onUnhide(id: string) {
    unhideJob(id);
    setHidden(loadHidden());
  }

  function onApply(job: Job) {
    // Opening the application counts as applied (only if untracked so far).
    if (!getStatus(job.id)) {
      setJobStatus(job, "applied");
      refreshStatuses();
    }
  }

  if (!hasProfile && !loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <EmptyState
          title="Build your profile to start finding internships."
          body="We match jobs against your actual skills and project technologies — add them first for accurate scores."
          ctaHref="/profile"
          ctaLabel="Build my profile"
        />
      </main>
    );
  }

  const effectiveLocation = remote ? "Remote" : city ? `${city}` : "anywhere";

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>Matches for your market</Kicker>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Jobs for you · {market.toUpperCase()} · {effectiveLocation}
          </h1>
          <p className="fjf-muted mt-1 text-xs">
            {sort === "match" ? "Sorted by your skill + project match" : "Sorted by newest first"} · {visible.length} jobs
            {source ? ` · Source: ${source}` : ""}
            {market !== profile.country ? ` · Profile market is ${profile.country.toUpperCase()}, searching ${market.toUpperCase()} instead` : ""}
          </p>
        </div>
        <Link href="/profile" className="fjf-accent text-sm font-medium">Edit profile</Link>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => { e.preventDefault(); void run(profile, query, market, city, remote, 1, false); }}
      >
        <label className="sr-only" htmlFor="job-market">Job country</label>
        <select
          id="job-market"
          className="fjf-select sm:w-44"
          value={market}
          onChange={(e) => {
            const next = e.target.value;
            setMarket(next);
            void run(profile, query, next, city, remote, 1, false);
          }}
          aria-label="Choose which country's jobs to search"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="job-city">City (optional override)</label>
        <input
          id="job-city"
          className="fjf-input sm:w-40"
          placeholder={profile.city || "City — optional"}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label="City override for this search"
          autoComplete="address-level2"
        />
        <input
          className="fjf-input flex-1"
          placeholder={`Search — try "${profile.skills.slice(0, 2).join(", ") || "react, python"}"`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search jobs"
        />
        <button type="submit" className="fjf-btn fjf-btn-primary" disabled={loading}>
          {loading ? "Finding matches…" : "Search"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            const next = !remote;
            setRemote(next);
            void run(profile, query, market, city, next, 1, false);
          }}
          aria-pressed={remote}
          className={`fjf-chip ${remote ? "fjf-chip-hit" : ""}`}
        >
          {remote ? "🌐 Remote-only: on" : "🌐 Remote-only: off"}
        </button>
        <label className="fjf-muted" htmlFor="job-sort">Sort</label>
        <select
          id="job-sort"
          className="fjf-select w-auto py-1 text-xs"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          aria-label="Sort jobs"
        >
          <option value="match">Best match</option>
          <option value="newest">Newest first</option>
        </select>
        <button
          type="button"
          onClick={() => setSavedOnly((v) => !v)}
          aria-pressed={savedOnly}
          className={`fjf-chip ${savedOnly ? "fjf-chip-hit" : ""}`}
        >
          {savedOnly ? "★ Showing saved" : "☆ Saved only"}
        </button>
        {city !== (profile.city || "") && (
          <button
            type="button"
            onClick={() => { setCity(profile.city || ""); void run(profile, query, market, profile.city || "", remote, 1, false); }}
            className="fjf-accent underline"
          >
            Reset city to profile ({profile.city || "none"})
          </button>
        )}
      </div>

      {broad && !loading && (
        <Card className="p-4 text-sm">
          <p>🔍 No exact matches for <strong>“{query}”</strong> — showing broader {market.toUpperCase()} roles instead. Try a wider keyword like “software intern”.</p>
        </Card>
      )}

      {hidden.length > 0 && !loading && (
        <p className="fjf-muted text-xs">
          {hidden.length} hidden as not interested.{" "}
          <button onClick={() => { clearHidden(); setHidden([]); }} className="fjf-accent underline">Undo all</button>
        </p>
      )}

      {profile.skills.length === 0 && profile.projects.length === 0 && !loading && (
        <Card className="p-4 text-sm">
          <p><strong>Tip:</strong> your profile has no skills or projects yet, so scores will look low. <Link href="/profile" className="fjf-accent underline">Add skills + projects</Link> (or import from GitHub) for accurate matches — search still works below.</p>
        </Card>
      )}

      {loading && (
        <div role="status" aria-live="polite">
          <p className="fjf-muted mb-3 text-sm">Finding jobs that match your profile… analyzing requirements… calculating compatibility…</p>
          <div className="grid gap-3 md:grid-cols-2">
            <JobCardSkeleton /><JobCardSkeleton /><JobCardSkeleton /><JobCardSkeleton />
          </div>
        </div>
      )}

      {error && !loading && (
        <Card className="p-5">
          <p role="alert" className="text-sm">{error}</p>
          <button onClick={() => run(profile, query, market, city, remote, 1, false)} className="fjf-btn fjf-btn-ghost fjf-btn-sm mt-3">Retry</button>
        </Card>
      )}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title={savedOnly ? "Nothing saved yet." : "We couldn't find matching jobs right now."}
          body={savedOnly ? "Tap ☆ on any job to keep it here for later." : "Try expanding your location, enabling remote opportunities, or searching a broader keyword like “software intern”."}
          ctaHref="/profile"
          ctaLabel="Adjust profile"
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map(({ job, match }, i) => {
          const salary = formatSalary(job);
          const posted = timeAgo(job.postedAt);
          const saved = bookmarks.includes(job.id);
          const status = statuses[job.id];
          return (
          <Card hover key={job.id} className="fjf-enter flex flex-col p-5" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="fjf-muted text-xs">{job.company || "Company"} · {jobKind(job)}{workModeLabel(job) ? ` · ${workModeLabel(job)}` : ""}</p>
                <h2 className="mt-0.5 font-semibold leading-snug">{job.title}</h2>
                <p className="fjf-muted mt-0.5 text-xs">
                  📍 {job.location || "—"}
                  {salary ? ` · 💰 ${salary}` : ""}
                  {posted ? ` · ${posted}` : ""}
                </p>
                <p className="fjf-muted mt-0.5 text-xs">{job.source ? `via ${job.source}` : ""}</p>
                {job.source === "mock" && (
                  <span className="fjf-chip mt-1.5 inline-block text-xs">🧪 Sample listing — add API keys for live jobs</span>
                )}
                {job.seniority === "senior" && (
                  <p className="mt-1.5 text-xs text-amber-700">⚠ Looks senior-level — check requirements before applying.</p>
                )}
                {status && (
                  <span className="fjf-chip fjf-chip-hit mt-1.5 inline-block text-xs">{STATUS_LABEL[status]}</span>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <MatchBadge score={match.score} />
                <button
                  onClick={() => onToggleBookmark(job)}
                  aria-pressed={saved}
                  aria-label={saved ? `Remove ${job.title} from saved` : `Save ${job.title} for later`}
                  className={`fjf-btn fjf-btn-ghost fjf-btn-sm ${saved ? "fjf-accent" : ""}`}
                >
                  {saved ? "★ Saved" : "☆ Save"}
                </button>
              </div>
            </div>

            {match.matchedSkills.length > 0 && (
              <div className="mt-3">
                <p className="fjf-kicker mb-1.5">You match</p>
                <div className="flex flex-wrap gap-1.5">
                  {match.matchedSkills.slice(0, 4).map((s) => (
                    <span key={s} className="fjf-chip fjf-chip-hit text-xs">✓ {s}</span>
                  ))}
                </div>
              </div>
            )}
            {match.missingSkills.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="fjf-muted">Missing:</span>
                {match.missingSkills.slice(0, 2).map((s) => (
                  <span key={s} className="fjf-chip text-xs">⚠ {s}</span>
                ))}
              </div>
            )}
            {match.projectHits[0] && (
              <p className="fjf-muted mt-2 text-xs">Best project: <span className="text-[#1e293b]">{match.projectHits[0]}</span></p>
            )}

            <div className="mt-4 flex gap-2 border-t border-[#e5e7eb] pt-4">
              <button onClick={() => viewJob(job)} className="fjf-btn fjf-btn-primary fjf-btn-sm flex-1">View job</button>
              {job.url && (
                <a href={job.url} target="_blank" rel="noreferrer" onClick={() => onApply(job)} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Apply ↗</a>
              )}
              <button onClick={() => onHide(job)} aria-label={`Hide ${job.title} — not interested`} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Hide</button>
            </div>
          </Card>
          );
        })}
      </div>

      {hasMore && !loading && visible.length > 0 && (
        <div className="text-center">
          <button
            onClick={() => run(profile, query, market, city, remote, page + 1, true)}
            disabled={loadingMore}
            className="fjf-btn fjf-btn-ghost"
          >
            {loadingMore ? "Loading more…" : `Load more (page ${page + 1})`}
          </button>
        </div>
      )}
    </main>
  );
}
