"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BreakdownBar, Card, EmptyState, Kicker, MatchBadge } from "@/components/ui";
import { extractJobSkills, matchProfileToJob } from "@/lib/matching";
import { historyForJob, loadProfileLocal } from "@/lib/resume";
import { formatSalary, timeAgo } from "@/lib/format";
import { learnLink, linkedinCompanyUrl, linkedinPeopleUrl } from "@/lib/resources";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  getStatus,
  isBookmarked,
  setJobStatus,
  toggleBookmark,
  type AppStatus,
} from "@/lib/tracker";
import type { Job, UserProfile } from "@/lib/types";

function loadJob(id: string): Job | null {
  try {
    const sel = localStorage.getItem("fjf-selected-job");
    if (sel) {
      const j = JSON.parse(sel) as Job;
      if (j.id === id) return j;
    }
    const cache = localStorage.getItem("fjf-jobs-cache");
    if (cache) {
      const list = JSON.parse(cache) as Job[];
      const found = list.find((x) => x.id === id);
      if (found) return found;
    }
  } catch {
    // ignore
  }
  return null;
}

export default function JobDetailsPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><p className="fjf-muted text-sm">Loading job…</p></main>}>
      <JobDetailsInner />
    </Suspense>
  );
}

function JobDetailsInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id || "");
  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [refetchFailed, setRefetchFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [docs, setDocs] = useState({ resume: false, letter: false });

  useEffect(() => {
    const p = loadProfileLocal();
    setProfile(p);
    const local = loadJob(id);
    if (local) {
      setJob(local);
      setSaved(isBookmarked(local.id));
      setStatus(getStatus(local.id));
    } else {
      void refetch(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Shared links carry the search context (?market=&q=) so the job can be
  // re-fetched even when this device never saw the original list.
  async function refetch(p: UserProfile | null) {
    setRefetching(true);
    setRefetchFailed(false);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: searchParams.get("market") || p?.country || "in",
          city: "",
          remoteOnly: false,
          jobType: p?.jobType || "internship",
          skills: p?.skills || [],
          query: searchParams.get("q") || "",
        }),
      });
      if (!res.ok) throw new Error(`jobs ${res.status}`);
      const data = await res.json();
      const list: Job[] = data.jobs || [];
      const found = list.find((x) => x.id === id) || null;
      if (found) {
        setJob(found);
        setSaved(isBookmarked(found.id));
        setStatus(getStatus(found.id));
        try {
          localStorage.setItem("fjf-selected-job", JSON.stringify(found));
        } catch {
          // ignore
        }
      } else {
        setRefetchFailed(true);
      }
    } catch {
      setRefetchFailed(true);
    } finally {
      setRefetching(false);
    }
  }

  const match = useMemo(
    () => (profile && job ? matchProfileToJob(profile, job) : null),
    [profile, job]
  );

  useEffect(() => {
    if (!job) return;
    const h = historyForJob(job.id);
    setDocs({
      resume: h.some((d) => d.kind === "resume"),
      letter: h.some((d) => d.kind === "cover-letter"),
    });
  }, [job]);
  const requirements = useMemo(() => (job ? extractJobSkills(job) : []), [job]);

  function tailor() {
    if (!job) return;
    try {
      localStorage.setItem("fjf-selected-job", JSON.stringify(job));
    } catch {
      // ignore
    }
    router.push("/resume");
  }

  function onToggleBookmark() {
    if (!job) return;
    const nowSaved = toggleBookmark(job.id);
    setSaved(nowSaved);
    if (nowSaved && !getStatus(job.id)) {
      setJobStatus(job, "saved");
      setStatus("saved");
    }
  }

  function onStatus(next: AppStatus | "") {
    if (!job || !next) return;
    setJobStatus(job, next);
    setStatus(next);
  }

  function onApply() {
    if (job && !getStatus(job.id)) {
      setJobStatus(job, "applied");
      setStatus("applied");
    }
  }

  if (!job) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {refetching ? (
          <Card className="space-y-3 p-6" aria-hidden>
            <div className="fjf-skeleton h-5 w-1/2" />
            <div className="fjf-skeleton h-4 w-full" />
            <div className="fjf-skeleton h-24 w-full" />
          </Card>
        ) : (
          <EmptyState
            title={refetchFailed ? "Couldn't reload this job." : "Job not found in this session."}
            body="Jobs load fresh from your market each visit. Go back to Jobs to reload your matches."
            ctaHref="/jobs"
            ctaLabel="Back to jobs"
          />
        )}
        {refetchFailed && (
          <div className="mt-3 text-center">
            <button onClick={() => refetch(profile)} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Try again</button>
          </div>
        )}
      </main>
    );
  }

  const salary = formatSalary(job);
  const posted = timeAgo(job.postedAt);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
      <Link href="/jobs" className="fjf-muted text-sm hover:text-white">← All jobs</Link>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Kicker>{job.company || "Company"}</Kicker>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{job.title}</h1>
            <p className="fjf-muted mt-1 text-sm">
              📍 {job.location || "—"}
              {salary ? ` · 💰 ${salary}` : ""}
              {posted ? ` · posted ${posted}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.workMode && job.workMode !== "unknown" && (
                <span className="fjf-chip text-xs">
                  {job.workMode === "remote" ? "🌐 Remote" : job.workMode === "hybrid" ? "🔀 Hybrid" : "🏢 On-site"}
                </span>
              )}
              {job.seniority && job.seniority !== "unknown" && (
                <span className={`fjf-chip text-xs ${job.seniority === "senior" ? "" : "fjf-chip-hit"}`}>
                  {job.seniority === "senior" ? "⚠ Senior-level" : job.seniority === "internship" ? "Internship" : "Entry-level"}
                </span>
              )}
              {job.contractType && <span className="fjf-chip text-xs">{job.contractType.replace(/_/g, " ")}</span>}
              {job.source && <span className="fjf-chip text-xs">via {job.source}</span>}
              {job.source === "mock" && (
                <span className="fjf-chip text-xs">🧪 Sample listing — add API keys for live jobs</span>
              )}
              {status && <span className="fjf-chip fjf-chip-hit text-xs">{STATUS_LABEL[status]}</span>}
            </div>
          </div>
          {match && <MatchBadge score={match.score} large />}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button onClick={tailor} className="fjf-btn fjf-btn-primary flex-1">
            Generate tailored resume →
          </button>
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" onClick={onApply} className="fjf-btn fjf-btn-ghost">
              Apply ↗
            </a>
          )}
          <button onClick={onToggleBookmark} aria-pressed={saved} className="fjf-btn fjf-btn-ghost">
            {saved ? "★ Saved" : "☆ Save"}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-[#1c1c1c] pt-4 sm:flex-row sm:items-center">
          <label className="fjf-muted text-xs" htmlFor="job-status">My application</label>
          <select
            id="job-status"
            className="fjf-select sm:w-48"
            value={status || ""}
            onChange={(e) => onStatus(e.target.value as AppStatus | "")}
            aria-label="Set application status"
          >
            <option value="">Not tracked</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">🪜 Your application progress</h2>
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span aria-hidden className="fjf-accent">✓</span>
            <span>Match reviewed{match ? ` (${match.score}%)` : ""}</span>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className={docs.resume ? "fjf-accent" : "fjf-muted"}>{docs.resume ? "✓" : "○"}</span>
            {docs.resume ? (
              <span>Resume tailored</span>
            ) : (
              <span>Resume — <button onClick={tailor} className="fjf-accent underline">tailor it for this job →</button></span>
            )}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className={docs.letter ? "fjf-accent" : "fjf-muted"}>{docs.letter ? "✓" : "○"}</span>
            {docs.letter ? (
              <span>Cover letter drafted</span>
            ) : (
              <span>Cover letter — <button onClick={tailor} className="fjf-accent underline">draft it on the resume page →</button></span>
            )}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className={status === "applied" || status === "interview" || status === "offer" ? "fjf-accent" : "fjf-muted"}>
              {status === "applied" || status === "interview" || status === "offer" ? "✓" : "○"}
            </span>
            {status === "applied" || status === "interview" || status === "offer" ? (
              <span>Applied — tracked as {status ? STATUS_LABEL[status] : ""}</span>
            ) : (
              <span>Apply above, then set your status below</span>
            )}
          </li>
        </ol>
      </Card>

      {job.seniority === "senior" && (        <Card className="border-amber-400/30 p-4 text-sm">
          <p><strong>⚠ Heads up:</strong> this posting looks senior-level (title/requirements mention seniority or years of experience). As a fresher you can still use it to spot skill gaps — or filter it out by searching “intern” / “junior” / “fresher”.</p>
        </Card>
      )}

      {match && (
        <Card className="p-6 sm:p-8">
          <h2 className="font-semibold">Why you&apos;re a match</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <BreakdownBar label="Skills" value={match.breakdown?.skills ?? match.score} />
              <BreakdownBar label="Projects" value={match.breakdown?.projects ?? match.score} />
              <BreakdownBar label="Experience" value={match.breakdown?.experience ?? match.score} />
              <div className="fjf-divider pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Overall</span>
                  <span className="fjf-match-ring fjf-accent text-lg font-bold">{match.score}%</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="fjf-kicker mb-2">You match</p>
                {match.matchedSkills.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {match.matchedSkills.map((s) => (
                      <span key={s} className="fjf-chip fjf-chip-hit text-xs">✓ {s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="fjf-muted text-sm">No direct skill overlap — your projects can still carry this.</p>
                )}
              </div>
              <div>
                <p className="fjf-kicker mb-2">You&apos;re missing</p>
                {match.missingSkills.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {match.missingSkills.slice(0, 6).map((s) => (
                      <span key={s} className="fjf-chip text-xs">⚠ {s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="fjf-muted text-sm">Nothing major — strong fit.</p>
                )}
              </div>
              {match.projectHits.length > 0 && (
                <div>
                  <p className="fjf-kicker mb-2">Relevant projects</p>
                  <ul className="space-y-1 text-sm">
                    {match.projectHits.slice(0, 3).map((t) => (
                      <li key={t} className="flex gap-2"><span aria-hidden className="fjf-accent">▸</span>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {requirements.length > 0 && (
        <Card className="p-6 sm:p-8">
          <h2 className="font-semibold">🔑 Key requirements at a glance</h2>
          <p className="fjf-muted mt-1 text-xs">Skills detected in this posting — check off what you have before applying.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {requirements.slice(0, 12).map((s) => {
              const have = match?.matchedSkills.some((m) => m.toLowerCase() === s.toLowerCase());
              return (
                <span key={s} className={`fjf-chip text-xs ${have ? "fjf-chip-hit" : ""}`}>
                  {have ? "✓ " : "· "}{s}
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {match && match.missingSkills.length > 0 && (
        <Card className="p-6 sm:p-8">
          <h2 className="font-semibold">📚 Close the gaps before you apply</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {match.missingSkills.slice(0, 5).map((s) => {
              const link = learnLink(s);
              return (
                <li key={s} className="flex items-start justify-between gap-3">
                  <span><strong>{s}</strong> <span className="fjf-muted">— missing from your profile</span></span>
                  <a href={link.url} target="_blank" rel="noreferrer" className="fjf-accent shrink-0 text-xs underline">
                    {link.label} ↗
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {job.company && (
        <Card className="p-6 sm:p-8">
          <h2 className="font-semibold">🤝 Don&apos;t just apply — get referred</h2>
          <p className="fjf-muted mt-1 text-sm leading-6">
            Freshers get hired through referrals far more than portals. Find people at {job.company},
            filter by your college, and ask for a 15-minute chat before you apply.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={linkedinPeopleUrl(job.company)} target="_blank" rel="noreferrer" className="fjf-btn fjf-btn-ghost fjf-btn-sm">
              People at {job.company} ↗
            </a>
            <a href={linkedinCompanyUrl(job.company)} target="_blank" rel="noreferrer" className="fjf-btn fjf-btn-ghost fjf-btn-sm">
              Company page ↗
            </a>
          </div>
        </Card>
      )}

      <Card className="p-6 sm:p-8">
        <h2 className="font-semibold">Job description</h2>
        <div className="mt-3 space-y-3 text-sm leading-7 text-[#c9c9c9]">
          {(job.description || "No description provided for this listing.")
            .split(/\n{2,}|\n/)
            .map((para) => para.trim())
            .filter(Boolean)
            .map((para, i) => <p key={i}>{para}</p>)}
        </div>
        {job.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {job.tags.map((t) => (
              <span key={t} className="fjf-chip text-xs">{t}</span>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
