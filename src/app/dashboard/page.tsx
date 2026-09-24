"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, JobCardSkeleton, Kicker, MatchBadge, Progress } from "@/components/ui";
import { matchProfileToJob } from "@/lib/matching";
import { profileStrength, topMissingSkills } from "@/lib/profile-strength";
import { loadProfileLocal } from "@/lib/resume";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  countNewIds,
  loadTracked,
  pipelineCounts,
  type AppStatus,
} from "@/lib/tracker";
import type { Job, UserProfile } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Animated number that eases to the target (instant under reduced motion). */
function useCountUp(target: number, active: boolean): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) {
      setVal(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 750;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setVal(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return val;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newCount, setNewCount] = useState(0);
  const reqId = useRef(0);
  const [pipeline, setPipeline] = useState<Record<AppStatus, number>>({
    saved: 0,
    applied: 0,
    interview: 0,
    rejected: 0,
    offer: 0,
  });
  const [recent, setRecent] = useState<{ id: string; title: string; company: string; status: AppStatus; updatedAt: string }[]>([]);

  useEffect(() => {
    const p = loadProfileLocal();
    setProfile(p);
    setPipeline(pipelineCounts());
    const tracked = Object.entries(loadTracked())
      .map(([id, t]) => ({ id, title: t.job.title, company: t.job.company, status: t.status, updatedAt: t.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
    setRecent(tracked);
    if (p) {
      void fetchJobs(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchJobs(p: UserProfile) {
    const my = ++reqId.current;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: p.country,
          city: p.city,
          remoteOnly: p.remoteOnly,
          jobType: p.jobType,
          skills: p.skills,
          query: "",
        }),
      });
      if (!res.ok) throw new Error(`jobs ${res.status}`);
      const data = await res.json();
      if (reqId.current !== my) return;
      const list: Job[] = data.jobs || [];
      setJobs(list);
      setNewCount(countNewIds(list.map((j) => j.id)));
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
      if (reqId.current === my) setLoading(false);
    }
  }

  const ranked = useMemo(
    () =>
      jobs
        .map((j) => ({ job: j, match: matchProfileToJob(profile as UserProfile, j) }))
        .sort((a, b) => b.match.score - a.match.score),
    [jobs, profile]
  );

  // Hooks must run before the early return below.
  const strongCount = ranked.filter((r) => r.match.score >= 70).length;
  const avgScore = ranked.length ? Math.round(ranked.reduce((s, r) => s + r.match.score, 0) / ranked.length) : 0;
  const ready = !loading;
  const jobsUp = useCountUp(ranked.length, ready);
  const strongUp = useCountUp(strongCount, ready);
  const avgUp = useCountUp(avgScore, ready && ranked.length > 0);

  if (profile === null) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <EmptyState
          title="Build your profile to start finding internships."
          body="Add your skills, projects, and target market. We'll match you against real job requirements and explain every score."
          ctaHref="/profile"
          ctaLabel="Build my profile"
        />
      </main>
    );
  }

  const strength = profileStrength(profile);
  const strong = strongCount;
  const avg = avgScore;
  const suggestions = topMissingSkills(ranked, profile.skills, 2);
  const firstName = profile.name.split(" ")[0] || "there";
  const appliedTotal = pipeline.applied + pipeline.interview + pipeline.offer;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting()}, {firstName} <span aria-hidden>👋</span>
        </h1>
        <p className="fjf-muted mt-1 text-sm">
          {profile.country.toUpperCase()}
          {profile.city ? ` · ${profile.city}` : ""} · {profile.remoteOnly ? "Remote" : profile.workMode || "On-site"} ·{" "}
          {profile.jobType === "both" ? "Internship + Entry" : profile.jobType}
          {newCount > 0 && (
            <span className="fjf-accent font-medium"> · 🆕 {newCount} new match{newCount === 1 ? "" : "es"} since your last visit</span>
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Card className="p-5">
          <Kicker>Profile strength</Kicker>
          <p className="fjf-match-ring mt-2 text-3xl font-bold">{strength.score}%</p>
          <div className="mt-3">
            <Progress value={strength.score} />
          </div>
          <p className="fjf-muted mt-3 text-xs leading-5">
            {strength.tips[0] || "Strong profile — keep your projects fresh."}
          </p>
          <Link href="/profile" className="fjf-btn fjf-btn-ghost fjf-btn-sm mt-4">
            Improve profile →
          </Link>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Matching jobs", value: loading ? "…" : String(jobsUp) },
            { label: "Strong matches", value: loading ? "…" : String(strongUp) },
            { label: "Average match", value: loading ? "…" : ranked.length ? `${avgUp}%` : "—" },
          ].map((s) => (
            <Card key={s.label} className="p-5 text-center">
              <p className="fjf-match-ring text-2xl font-bold sm:text-3xl">{s.value}</p>
              <p className="fjf-muted mt-1 text-xs">{s.label}</p>
            </Card>
          ))}
        </div>
      </div>

      <section aria-label="Application pipeline">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">🧭 Your applications</h2>
          <Link href="/jobs" className="fjf-accent text-sm font-medium">Find more →</Link>
        </div>
        <Card className="p-5">
          {appliedTotal === 0 && pipeline.saved === 0 ? (
            <p className="fjf-muted text-sm">
              Nothing tracked yet. Save interesting jobs with ☆ and mark them as you apply — your pipeline lives here.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2" aria-live="polite">
                {STATUS_ORDER.map((s) => (
                  <span key={s} className={`fjf-chip text-xs ${pipeline[s] > 0 ? "fjf-chip-hit" : ""}`}>
                    {STATUS_LABEL[s]} · {pipeline[s]}
                  </span>
                ))}
              </div>
              {recent.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm">
                  {recent.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <Link href={`/jobs/${encodeURIComponent(r.id)}?market=${encodeURIComponent(profile.country || "in")}`} className="min-w-0 truncate hover:underline">
                        <span className="font-medium">{r.title}</span>
                        <span className="fjf-muted"> · {r.company || "Company"}</span>
                      </Link>
                      <span className="fjf-chip shrink-0 text-xs">{STATUS_LABEL[r.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
      </section>

      {error && (
        <Card className="border-[#4a2a2a] p-4 text-sm" >
          <p role="alert">{error}</p>
          <button onClick={() => profile && fetchJobs(profile)} className="fjf-btn fjf-btn-ghost fjf-btn-sm mt-3">
            Retry
          </button>
        </Card>
      )}

      <section aria-label="Strongest matches">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">🔥 Your strongest matches</h2>
          <Link href="/jobs" className="fjf-accent text-sm font-medium">View all →</Link>
        </div>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-3">
            <JobCardSkeleton /><JobCardSkeleton /><JobCardSkeleton />
          </div>
        ) : ranked.length === 0 ? (
          <EmptyState
            title="We couldn't find matching jobs right now."
            body="Try expanding your location or enabling remote opportunities."
            ctaHref="/jobs"
            ctaLabel="Search jobs"
          />
        ) : (
              <div className="grid gap-3 md:grid-cols-3">
            {ranked.slice(0, 3).map(({ job, match }, i) => (
              <Card hover key={job.id} className="fjf-enter flex flex-col p-5" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{job.title}</p>
                    <p className="fjf-muted truncate text-xs">{job.company} · {job.location}</p>
                  </div>
                </div>
                <div className="mt-3"><MatchBadge score={match.score} /></div>
                <p className="fjf-muted mt-2 line-clamp-2 text-xs leading-5">{match.reasons[0] || "Profile overlap found."}</p>
                <Link href={`/jobs/${encodeURIComponent(job.id)}?market=${encodeURIComponent(profile.country || "in")}`} className="fjf-btn fjf-btn-ghost fjf-btn-sm mt-4 self-start">
                  View job
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Improve your profile">
        <h2 className="mb-3 font-semibold">💡 Improve your profile</h2>
        <Card className="p-5">
          {suggestions.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {suggestions.map((s) => (
                <li key={s} className="flex gap-2">
                  <span aria-hidden className="fjf-accent">▸</span>
                  <span>Adding <strong>{s}</strong> to your skills or a project could unlock more opportunities like your top matches.</span>
                </li>
              ))}
              {strength.tips.slice(0, 1).map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden className="fjf-accent">▸</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fjf-muted text-sm">Your skills already cover your top matches well. Add a new project to push strong matches higher.</p>
          )}
        </Card>
      </section>
    </main>
  );
}
