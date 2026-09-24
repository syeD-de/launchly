"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, Kicker, MatchBadge, Progress } from "@/components/ui";
import { extractJobSkills, matchProfileToJob } from "@/lib/matching";
import {
  deleteDocEntry,
  historyForJob,
  loadDocHistory,
  loadProfileLocal,
  saveDocEntry,
  type SavedDoc,
} from "@/lib/resume";
import { timeAgo } from "@/lib/format";
import { getStatus, setJobStatus, type AppStatus } from "@/lib/tracker";
import type { Job, UserProfile } from "@/lib/types";

type Status = "idle" | "working" | "done" | "error";

function download(filename: string, text: string) {
  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    // ignore
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "resume";
}

export default function ResumePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState("");
  const [letter, setLetter] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [letterStatus, setLetterStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [letterError, setLetterError] = useState("");
  const [copied, setCopied] = useState<"resume" | "letter" | null>(null);
  const [history, setHistory] = useState<SavedDoc[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);

  useEffect(() => {
    setProfile(loadProfileLocal());
    try {
      const raw = localStorage.getItem("fjf-selected-job");
      if (raw) {
        const j = JSON.parse(raw) as Job;
        setJob(j);
        setHistory(historyForJob(j.id));
        setAppStatus(getStatus(j.id));
      }
      setHistory((h) => (h.length ? h : loadDocHistory().slice(0, 5)));
    } catch {
      // ignore
    }
  }, []);

  const match = profile && job ? matchProfileToJob(profile, job) : null;

  const coverage = useMemo(() => {
    if (!job) return null;
    const skills = extractJobSkills(job);
    if (!skills.length) return null;
    const matched = match?.matchedSkills.map((s) => s.toLowerCase()) || [];
    const hit = skills.filter((s) => matched.includes(s.toLowerCase())).length;
    return { total: skills.length, hit, pct: Math.round((hit / skills.length) * 100), skills };
  }, [job, match]);

  async function generate() {
    if (!profile || !job) return;
    setStatus("working");
    setError("");
    try {
      const res = await fetch("/api/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, job }),
      });
      if (!res.ok) throw new Error(`resume ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const text: string = data.resume || "";
      setResume(text);
      setStatus("done");
      try {
        localStorage.setItem("fjf-last-resume", text);
      } catch {
        // ignore
      }
      const entry = saveDocEntry({
        kind: "resume",
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        text,
        matchScore: data.match?.score ?? match?.score ?? 0,
        engine: data.engine || "unknown",
      });
      setHistory([entry, ...historyForJob(job.id).filter((h) => h.id !== entry.id)]);
    } catch (e) {
      console.error(e);
      setError("Something went wrong while generating your resume. Please try again.");
      setStatus("error");
    }
  }

  async function generateLetter() {
    if (!profile || !job) return;
    setLetterStatus("working");
    setLetterError("");
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, job }),
      });
      if (!res.ok) throw new Error(`letter ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const text: string = data.letter || "";
      setLetter(text);
      setLetterStatus("done");
      const entry = saveDocEntry({
        kind: "cover-letter",
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        text,
        matchScore: data.match?.score ?? match?.score ?? 0,
        engine: data.engine || "unknown",
      });
      setHistory([entry, ...historyForJob(job.id).filter((h) => h.id !== entry.id)]);
    } catch (e) {
      console.error(e);
      setLetterError("Something went wrong while drafting your cover letter. Please try again.");
      setLetterStatus("error");
    }
  }

  async function copy(text: string, which: "resume" | "letter") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // ignore
    }
  }

  function markApplied() {
    if (!job) return;
    setJobStatus(job, "applied");
    setAppStatus("applied");
  }

  const hasLetter = !!letter || history.some((h) => h.kind === "cover-letter");
  const applied = appStatus === "applied" || appStatus === "interview" || appStatus === "offer";

  function openHistoryEntry(entry: SavedDoc) {
    if (entry.kind === "resume") {
      setResume(entry.text);
      setStatus("done");
    } else {
      setLetter(entry.text);
      setLetterStatus("done");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeHistoryEntry(id: string) {
    deleteDocEntry(id);
    if (job) setHistory(historyForJob(job.id));
    else setHistory(loadDocHistory().slice(0, 5));
  }

  if (profile === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          title="Build your profile first."
          body="Your tailored resume is generated from your skills, projects, and the job you pick."
          ctaHref="/profile"
          ctaLabel="Build my profile"
        />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Kicker>AI resume tailoring</Kicker>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your tailored resumes will appear here.</h1>
        <EmptyState
          title="No job selected yet."
          body="Generate a tailored resume for your first job application — pick a match and we'll customize everything to it."
          ctaHref="/jobs"
          ctaLabel="Find a job to tailor for"
        />
        {history.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Recent documents</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    <span className="fjf-muted text-xs">{h.kind === "resume" ? "Resume" : "Cover letter"} · </span>
                    {h.jobTitle} <span className="fjf-muted">· {h.company}</span>
                  </span>
                  <span className="fjf-muted shrink-0 text-xs">{timeAgo(h.createdAt) || ""}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
      <div>
        <Kicker>AI resume tailoring</Kicker>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Resume for this job</h1>
        <p className="fjf-muted mt-1 text-sm">Generate a resume customized for this specific job using your profile and the job requirements.</p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="font-semibold">{job.title}</p>
          <p className="fjf-muted text-sm">{job.company} · {job.location}</p>
          <p className="fjf-muted mt-1 text-xs">
            {profile.resumeText?.trim()
              ? "✂️ Tailoring your existing resume to this job."
              : "✨ No existing resume on file — generating one from your profile. "}
            {!profile.resumeText?.trim() && (
              <Link href="/profile" className="fjf-accent underline">Add your resume for better results</Link>
            )}
          </p>
        </div>
        {match && <MatchBadge score={match.score} />}
      </Card>

      {coverage && (
        <Card className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">🎯 Keyword coverage (ATS check)</h2>
            <span className="fjf-match-ring text-sm font-bold">{coverage.pct}% · {coverage.hit}/{coverage.total}</span>
          </div>
          <div className="mt-3"><Progress value={coverage.pct} /></div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {coverage.skills.slice(0, 12).map((s) => {
              const hit = match?.matchedSkills.some((m) => m.toLowerCase() === s.toLowerCase());
              return (
                <span key={s} className={`fjf-chip text-xs ${hit ? "fjf-chip-hit" : ""}`}>
                  {hit ? "✓ " : "✕ "}{s}
                </span>
              );
            })}
          </div>
          <p className="fjf-muted mt-2 text-xs">Tip: weave the ✕ keywords into your resume where they are true for you — then regenerate.</p>
        </Card>
      )}

      {resume && (
        <Card className="fjf-enter border-emerald-900/50 p-5">
          <h2 className="text-sm font-semibold">🚀 Ready to apply? Finish the loop</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span aria-hidden className="fjf-accent">✓</span>
              <span>Resume tailored for {job.title}</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className={hasLetter ? "fjf-accent" : "fjf-muted"}>{hasLetter ? "✓" : "○"}</span>
              {hasLetter ? (
                <span>Cover letter drafted</span>
              ) : (
                <span>Cover letter — <button onClick={generateLetter} disabled={letterStatus === "working"} className="fjf-accent underline">
                  {letterStatus === "working" ? "drafting…" : "draft it in one click"}
                </button></span>
              )}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className={applied ? "fjf-accent" : "fjf-muted"}>{applied ? "✓" : "○"}</span>
              {applied ? (
                <span>Application tracked<Link href="/dashboard" className="fjf-accent underline"> — view pipeline</Link></span>
              ) : (
                <span>Apply, then mark it below so your pipeline stays honest</span>
              )}
            </li>
          </ul>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {job.url ? (
              <a href={job.url} target="_blank" rel="noreferrer" onClick={markApplied} className="fjf-btn fjf-btn-primary flex-1">
                Apply for this job ↗
              </a>
            ) : (
              <p className="fjf-muted flex-1 text-xs leading-5">
                No direct application link for this listing — check {job.company || "the company"}&apos;s careers page, then mark applied below.
              </p>
            )}
            {!applied && (
              <button onClick={markApplied} className="fjf-btn fjf-btn-ghost">
                Mark as applied ✓
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <Card className="h-fit p-5">
            <h2 className="text-sm font-semibold">What tailoring does</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#c9c9c9]">
              {["Relevant skills prioritized", "Relevant project highlighted", "Job-specific keywords included", "ATS-friendly formatting"].map((f) => (
                <li key={f} className="flex gap-2"><span aria-hidden className="fjf-accent">✓</span>{f}</li>
              ))}
            </ul>
            <button onClick={generate} disabled={status === "working"} className="fjf-btn fjf-btn-primary mt-5 w-full">
              {status === "working" ? "Generating your tailored resume…" : resume ? "Regenerate resume" : "Generate tailored resume →"}
            </button>
            {resume && (
              <div className="mt-2 grid grid-cols-2 gap-2 no-print">
                <button onClick={() => copy(resume, "resume")} className="fjf-btn fjf-btn-ghost fjf-btn-sm">{copied === "resume" ? "Copied ✓" : "Copy"}</button>
                <button onClick={() => download(`${slug(job.title)}-resume.txt`, resume)} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Download</button>
              </div>
            )}
            {resume && (
              <button onClick={() => window.print()} className="fjf-btn fjf-btn-ghost fjf-btn-sm mt-2 w-full no-print">Print / PDF</button>
            )}
            {status === "working" && (
              <p role="status" className="fjf-muted mt-3 text-xs">Analyzing requirements… rewriting bullets… keeping it truthful to your profile…</p>
            )}
            {status === "error" && (
              <p role="alert" className="mt-3 text-xs">{error} <button onClick={generate} className="fjf-accent underline">Try again</button></p>
            )}
          </Card>

          <Card className="h-fit p-5">
            <h2 className="text-sm font-semibold">✉️ Cover letter</h2>
            <p className="fjf-muted mt-1 text-xs leading-5">A short, honest draft for this exact job — same engine as the resume.</p>
            <button onClick={generateLetter} disabled={letterStatus === "working"} className="fjf-btn fjf-btn-ghost mt-3 w-full">
              {letterStatus === "working" ? "Drafting…" : letter ? "Regenerate letter" : "Draft cover letter →"}
            </button>
            {letter && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => copy(letter, "letter")} className="fjf-btn fjf-btn-ghost fjf-btn-sm">{copied === "letter" ? "Copied ✓" : "Copy"}</button>
                <button onClick={() => download(`${slug(job.title)}-cover-letter.txt`, letter)} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Download</button>
              </div>
            )}
            {letterStatus === "error" && (
              <p role="alert" className="mt-3 text-xs">{letterError} <button onClick={generateLetter} className="fjf-accent underline">Try again</button></p>
            )}
          </Card>

          {history.length > 0 && (
            <Card className="h-fit p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">🕘 History for this job</h2>
                <button onClick={() => setShowHistory((v) => !v)} className="fjf-accent text-xs underline">
                  {showHistory ? "Hide" : `Show (${history.length})`}
                </button>
              </div>
              {showHistory && (
                <ul className="mt-3 space-y-2 text-xs">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-2 border-t border-[#1c1c1c] pt-2">
                      <button onClick={() => openHistoryEntry(h)} className="min-w-0 flex-1 text-left hover:underline">
                        <span className="font-medium">{h.kind === "resume" ? "Resume" : "Cover letter"}</span>
                        <span className="fjf-muted"> · {h.matchScore}% · {timeAgo(h.createdAt) || "recently"}</span>
                      </button>
                      <button onClick={() => removeHistoryEntry(h.id)} aria-label="Delete this version" className="fjf-muted shrink-0 hover:text-white">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {!resume && status !== "working" && (
            <Card className="p-8 text-center">
              <p className="text-4xl" aria-hidden>✨</p>
              <p className="mt-2 font-semibold">Ready when you are</p>
              <p className="fjf-muted mx-auto mt-1 max-w-sm text-sm">One click rewrites your summary, reorders skills, and spotlights the project that proves you fit this role.</p>
            </Card>
          )}
          {status === "working" && (
            <Card className="space-y-3 p-6" aria-hidden>
              <div className="fjf-skeleton h-5 w-1/2" />
              <div className="fjf-skeleton h-4 w-full" />
              <div className="fjf-skeleton h-4 w-full" />
              <div className="fjf-skeleton h-24 w-full" />
              <div className="fjf-skeleton h-24 w-full" />
            </Card>
          )}
          {resume && (
            <Card className="print-doc overflow-hidden p-0">
              <div className="border-b border-[#1c1c1c] px-6 py-3 no-print">
                <p className="fjf-kicker">Preview · {profile.name || "Your resume"} → {job.title}</p>
              </div>
              <pre className="whitespace-pre-wrap px-6 py-5 text-sm leading-7 text-[#e8e8e8]">{resume}</pre>
            </Card>
          )}
          {letter && (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-[#1c1c1c] px-6 py-3">
                <p className="fjf-kicker">Cover letter · {job.title} @ {job.company || "Company"}</p>
              </div>
              <pre className="whitespace-pre-wrap px-6 py-5 text-sm leading-7 text-[#e8e8e8]">{letter}</pre>
            </Card>
          )}
        </div>
      </div>

      <p className="fjf-muted text-xs">Tip: keep every line truthful — tailoring rephrases and emphasizes your real work; it never invents jobs or degrees. <Link href={`/jobs/${encodeURIComponent(job.id)}`} className="fjf-accent">Back to job details →</Link></p>
    </main>
  );
}
