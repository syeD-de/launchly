"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, FieldError, Kicker, Progress } from "@/components/ui";
import GitHubImport from "@/components/GitHubImport";
import { matchProfileToJob } from "@/lib/matching";
import { profileStrength } from "@/lib/profile-strength";
import { loadProfileLocal, PROFILE_KEY } from "@/lib/resume";
import { COUNTRY_OPTIONS, EMPTY_PROFILE, type Job, type UserProfile } from "@/lib/types";

type WorkMode = "remote" | "onsite" | "hybrid";

export default function ProfilePage() {
  const [p, setP] = useState<UserProfile>(EMPTY_PROFILE);
  const [skillInput, setSkillInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [editingExp, setEditingExp] = useState<number | null>(null);
  const [resumeFileError, setResumeFileError] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);
  // First paint must match the server exactly (it has no localStorage) —
  // anything cache-dependent waits until after mount, or hydration breaks.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const skipAutosave = useRef(true);

  useEffect(() => {
    const existing = loadProfileLocal();
    if (existing) {
      skipAutosave.current = true;
      setP({ ...EMPTY_PROFILE, ...existing });
      setSaved(true);
      setLastSavedAt(new Date().toISOString());
    } else {
      skipAutosave.current = false;
    }
  }, []);

  // Draft autosave: every change lands in localStorage, so navigating away
  // mid-form never loses work. The Save button remains for certainty.
  useEffect(() => {
    if (skipAutosave.current) {
      skipAutosave.current = false;
      return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      } catch {
        // ignore
      }
      setSaved(true);
      setLastSavedAt(new Date().toISOString());
    }, 800);
    return () => clearTimeout(t);
  }, [p]);

  // Warn before leaving with unsaved (not-yet-autosaved) changes.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!saved) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saved]);

  // In-app navigation doesn't fire beforeunload and unmounts before the
  // debounce elapses — flush the latest draft synchronously on unmount.
  const latestP = useRef(p);
  latestP.current = p;
  useEffect(() => {
    return () => {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(latestP.current));
      } catch {
        // ignore
      }
    };
  }, []);

  const strength = useMemo(() => profileStrength(p), [p]);
  const workMode: WorkMode = p.workMode || (p.remoteOnly ? "remote" : "onsite");

  function update<K extends keyof UserProfile>(k: K, v: UserProfile[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  function setWorkMode(m: WorkMode) {
    setP((prev) => ({ ...prev, workMode: m, remoteOnly: m === "remote" }));
    setSaved(false);
  }

  function addSkill(raw?: string) {
    // Split on commas/newlines so pasting "Python, React, SQL" adds 3 chips
    const parts = (raw ?? skillInput).split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...p.skills];
    for (const part of parts) {
      if (!next.some((s) => s.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    update("skills", next);
    setSkillInput("");
  }

  function removeSkill(s: string) {
    update("skills", p.skills.filter((x) => x !== s));
  }

  function addProject() {
    update("projects", [...p.projects, { title: "", description: "", techStack: [], link: "", demoUrl: "" }]);
    setEditingProject(p.projects.length);
  }

  function addExperience() {
    update("experience", [...p.experience, { title: "", org: "", description: "" }]);
    setEditingExp(p.experience.length);
  }

  function onResumeFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 200_000) {
      setResumeFileError("File too large — keep it under 200 KB, or paste the text instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update("resumeText", String(reader.result || "").slice(0, 20000));
      setResumeFileError("");
    };
    reader.onerror = () => setResumeFileError("Couldn't read that file — try pasting the text instead.");
    reader.readAsText(f);
  }

  function exportData() {
    try {
      const dump: Record<string, unknown> = { exportedAt: new Date().toISOString() };
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("fjf-")) {
          try {
            dump[k] = JSON.parse(localStorage.getItem(k) || "null");
          } catch {
            dump[k] = localStorage.getItem(k);
          }
        }
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "launchly-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      // ignore
    }
  }

  function loadDemo() {
    const demo: UserProfile = {
      ...EMPTY_PROFILE,
      name: "Aarav Sharma",
      email: "aarav.sharma@mail.com",
      phone: "9876543210",
      country: "in",
      city: "Bengaluru",
      jobType: "internship",
      skills: ["React", "JavaScript", "HTML", "CSS", "Git", "REST"],
      summary: "CS fresher. Built 3 web apps with React + Node. Looking for a frontend internship where I can ship real UI.",
      githubUrl: "https://github.com/aaravsharma",
      education: {
        degree: "B.Tech in Computer Science",
        college: "Visvesvaraya Technological University",
        year: "Third-Year Student",
      },
      projects: [
        {
          title: "Shop UI",
          description: "Store front with cart, filters, and checkout flow. Used by 200+ classmates during a campus fest.",
          techStack: ["React", "JavaScript", "CSS"],
          link: "https://github.com/aaravsharma/shop-ui",
          demoUrl: "",
        },
        {
          title: "Notes API",
          description: "REST API with auth and search. Handles 1k+ requests in load tests without errors.",
          techStack: ["JavaScript", "REST", "SQL"],
          link: "",
          demoUrl: "",
        },
      ],
      experience: [
        {
          title: "Web Dev Volunteer",
          org: "College Tech Club",
          description: "Shipped event pages with a team of 4; fixed bugs the night before fest.",
        },
      ],
    };
    setP(demo);
    setSaved(false);
  }

  function wipeData() {    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("fjf-")) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
    } catch {
      // ignore
    }
    setConfirmWipe(false);
    window.location.reload();
  }

  function importGitHubProject(proj: UserProfile["projects"][number], skillHints: string[]) {    const skills = [...p.skills];
    for (const s of skillHints) {
      if (s && !skills.some((x) => x.toLowerCase() === s.toLowerCase())) skills.push(s);
    }
    setP((prev) => ({ ...prev, skills, projects: [...prev.projects, proj] }));
    setSaved(false);
  }

  function save() {
    const errs: typeof errors = {};
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errs.email = "Enter a valid email address.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    // Flush any still-typed skill so "type + Save" never silently drops it
    let next: UserProfile = p;
    const pending = skillInput.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean)
      .filter((s) => !next.skills.some((x) => x.toLowerCase() === s.toLowerCase()));
    if (pending.length) {
      next = { ...next, skills: [...next.skills, ...pending] };
      setP(next);
      setSkillInput("");
    }
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setSaved(true);
    setLastSavedAt(new Date().toISOString());
  }

  // Skills employers actually ask for in your cached matches — one-click add.
  // Mount-gated: localStorage doesn't exist during server render.
  const skillSuggestions = useMemo(() => {
    if (!mounted) return [];
    try {
      const raw = localStorage.getItem("fjf-jobs-cache");
      if (!raw) return [];
      const cached = JSON.parse(raw) as Job[];
      if (!Array.isArray(cached) || cached.length === 0) return [];
      const own = new Set(p.skills.map((s) => s.toLowerCase()));
      const freq = new Map<string, number>();
      for (const j of cached.slice(0, 15)) {
        const m = matchProfileToJob(p, j);
        for (const s of m.missingSkills) {
          const k = s.toLowerCase();
          if (!own.has(k)) freq.set(s, (freq.get(s) || 0) + 1);
        }
      }
      return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, p.skills.join("|")]);

  const checklist = useMemo(() => {
    const goodProjects = p.projects.filter((x) => x.title.trim() && x.techStack.length > 0).length;
    return [
      { label: "Basics (name + email)", done: p.name.trim() !== "" && /.+@.+\..+/.test(p.email), href: "#pf-basic" },
      { label: "5+ skills", done: p.skills.length >= 5, href: "#pf-skills" },
      { label: "Summary of what you build", done: p.summary.trim().length >= 40, href: "#pf-summary" },
      { label: "2 projects with tech stacks", done: goodProjects >= 2, href: "#pf-projects" },
      { label: "Experience or pasted resume", done: p.experience.length > 0 || (p.resumeText || "").trim().length > 100, href: "#pf-exp" },
    ];
  }, [p]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div>
        <Kicker>Your profile</Kicker>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Skills, projects, preferences</h1>
        <p className="fjf-muted mt-1 max-w-2xl text-sm leading-6">
          Jobs are targeted by your country / city / work mode. Matching compares your skills + project tech + experience against each job.
          {saved ? (
            <span className="fjf-accent"> Drafts autosave{lastSavedAt ? ` · saved ${new Date(lastSavedAt).toLocaleTimeString()}` : ""} ✓</span>
          ) : (
                <span className="text-amber-700"> Unsaved changes…</span>
          )}
          <br />
          <button onClick={loadDemo} className="fjf-accent underline">Just exploring? Load demo data →</button>
        </p>
      </div>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Get to 100%: {checklist.filter((c) => c.done).length}/{checklist.length} steps done
          </p>
          <span className="fjf-muted text-xs">Profile strength {strength.score}%</span>
        </div>
        <div className="mt-3"><Progress value={(checklist.filter((c) => c.done).length / checklist.length) * 100} /></div>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {checklist.map((c) => (
            <li key={c.label}>
              <a href={c.href} className="flex items-center gap-2 text-sm hover:underline">
                <span aria-hidden className={c.done ? "fjf-accent" : "fjf-muted"}>{c.done ? "✓" : "○"}</span>
                <span className={c.done ? "fjf-muted line-through" : ""}>{c.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {/* Basic info */}
          <Card className="p-5 sm:p-6" >
            <h2 className="font-semibold" id="pf-basic">👤 Basic information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="fjf-label" htmlFor="pf-name">Name</label>
                <input id="pf-name" className="fjf-input" value={p.name} onChange={(e) => update("name", e.target.value)} placeholder="Aarav Sharma" autoComplete="name" />
              </div>
              <div>
                <label className="fjf-label" htmlFor="pf-email">Email</label>
                <input id="pf-email" className="fjf-input" type="email" value={p.email} onChange={(e) => update("email", e.target.value)} placeholder="you@mail.com" autoComplete="email" />
                <FieldError message={errors.email} />
              </div>
              <div>
                <label className="fjf-label" htmlFor="pf-phone">Phone (for resume header)</label>
                <input id="pf-phone" className="fjf-input" type="tel" value={p.phone || ""} onChange={(e) => update("phone", e.target.value)} placeholder="9962286098" autoComplete="tel" />
              </div>
              <div>
                <label className="fjf-label" htmlFor="pf-country">Country / job market</label>
                <select id="pf-country" className="fjf-select" value={p.country} onChange={(e) => update("country", e.target.value)}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fjf-label" htmlFor="pf-city">City</label>
                <input id="pf-city" className="fjf-input" value={p.city} onChange={(e) => update("city", e.target.value)} placeholder="Bengaluru" autoComplete="address-level2" />
              </div>
            </div>
          </Card>

          {/* Education */}
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold">🎓 Education</h2>
            <p className="fjf-muted mt-1 text-xs leading-5">
              Shown at the top of every generated resume, exactly like a real header block.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="fjf-label" htmlFor="pf-degree">Degree</label>
                <input id="pf-degree" className="fjf-input" value={p.education?.degree || ""} onChange={(e) => update("education", { degree: e.target.value, college: p.education?.college || "", year: p.education?.year || "" })} placeholder="B.Tech in AI and Machine Learning" />
              </div>
              <div>
                <label className="fjf-label" htmlFor="pf-college">College</label>
                <input id="pf-college" className="fjf-input" value={p.education?.college || ""} onChange={(e) => update("education", { degree: p.education?.degree || "", college: e.target.value, year: p.education?.year || "" })} placeholder="SRM Institute of Science and Technology" />
              </div>
              <div>
                <label className="fjf-label" htmlFor="pf-year">Year / status</label>
                <input id="pf-year" className="fjf-input" value={p.education?.year || ""} onChange={(e) => update("education", { degree: p.education?.degree || "", college: p.education?.college || "", year: e.target.value })} placeholder="Second-Year Student" />
              </div>
            </div>
          </Card>

          {/* Links (GitHub + LinkedIn) */}
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold">🔗 Links</h2>
            <p className="fjf-muted mt-1 text-xs leading-5">
              Shown on your tailored resume. Your GitHub also powers one-click project imports below.
              LinkedIn can&apos;t be auto-read (it requires login), so we link it on your resume instead.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="fjf-label" htmlFor="pf-github">GitHub URL</label>
                <input id="pf-github" className="fjf-input" type="url" value={p.githubUrl || ""} onChange={(e) => update("githubUrl", e.target.value)} placeholder="https://github.com/yourname" autoComplete="url" />
              </div>
              <div>
                <label className="fjf-label" htmlFor="pf-linkedin">LinkedIn URL</label>
                <input id="pf-linkedin" className="fjf-input" type="url" value={p.linkedinUrl || ""} onChange={(e) => update("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/yourname" autoComplete="url" />
              </div>
            </div>
          </Card>

          {/* Preferences */}
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold">🎯 Job preferences</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="fjf-label" id="jobtype-label">I&apos;m looking for</p>
                <div className="fjf-seg" role="group" aria-labelledby="jobtype-label">
                  {(["internship", "entry", "both"] as const).map((t) => (
                    <button key={t} type="button" aria-pressed={p.jobType === t} onClick={() => update("jobType", t)}>
                      {t === "internship" ? "Internship" : t === "entry" ? "Full-time" : "Both"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="fjf-label" id="workmode-label">Work mode</p>
                <div className="fjf-seg" role="group" aria-labelledby="workmode-label">
                  {(["remote", "onsite", "hybrid"] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={workMode === m} onClick={() => setWorkMode(m)}>
                      {m === "remote" ? "Remote" : m === "onsite" ? "On-site" : "Hybrid"}
                    </button>
                  ))}
                </div>
                <p className="fjf-muted mt-2 text-xs">Remote-only unlocks no-key remote job sources; city targeting applies otherwise.</p>
              </div>
            </div>
          </Card>

          {/* Skills */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold" id="pf-skills">🧠 Skills</h2>
              <span className="fjf-muted text-xs">{p.skills.length} added</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
              {p.skills.map((s) => (
                <span key={s} className="fjf-chip">
                  {s}
                  <button type="button" aria-label={`Remove ${s}`} onClick={() => removeSkill(s)}>×</button>
                </span>
              ))}
              {p.skills.length === 0 && <p className="fjf-muted text-sm">No skills yet — add your first one below.</p>}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); addSkill(); }}
            >
              <input
                className="fjf-input"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Add skill — e.g. Python, React, SQL"
                aria-label="Add a skill"
              />
              <button type="submit" className="fjf-btn fjf-btn-ghost fjf-btn-sm shrink-0">+ Add</button>
            </form>
            {skillSuggestions.length > 0 && (
              <div className="mt-3">
                <p className="fjf-kicker mb-1.5">In demand in your matches — tap to add</p>
                <div className="flex flex-wrap gap-1.5">
                  {skillSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSkill(s)}
                      className="fjf-chip text-xs hover:underline"
                      aria-label={`Add suggested skill ${s}`}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Summary */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold" id="pf-summary">📝 Summary</h2>
              <span className="fjf-muted text-xs">{p.summary.length}/400</span>
            </div>
            <textarea
              className="fjf-textarea mt-3"
              rows={4}
              maxLength={400}
              value={p.summary}
              onChange={(e) => update("summary", e.target.value.slice(0, 400))}
              placeholder="CS fresher. Built 3 web apps with React + Node. Looking for a frontend internship where I can ship real UI."
              aria-label="Professional summary"
            />
          </Card>

          {/* Existing resume */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold" id="pf-resume">📄 Existing resume</h2>
              <span className="fjf-muted text-xs">{(p.resumeText || "").length.toLocaleString()}/20,000</span>
            </div>
            <p className="fjf-muted mt-1 text-xs leading-5">
              Already have a resume? Paste it or upload a text file — when you pick a job we&apos;ll tailor
              <em> this resume</em> to that job instead of generating one from scratch.
            </p>
            <textarea
              className="fjf-textarea mt-3"
              rows={8}
              maxLength={20000}
              value={p.resumeText || ""}
              onChange={(e) => update("resumeText", e.target.value.slice(0, 20000))}
              placeholder="Paste your current resume here — name, education, skills, projects, experience…"
              aria-label="Existing resume text"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="fjf-btn fjf-btn-ghost fjf-btn-sm cursor-pointer">
                Upload .txt / .md
                <input
                  type="file"
                  accept=".txt,.md,.text,.rst,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => { onResumeFile(e.target.files?.[0]); e.target.value = ""; }}
                />
              </label>
              {(p.resumeText || "") && (
                <button onClick={() => update("resumeText", "")} className="fjf-btn fjf-btn-ghost fjf-btn-sm">
                  Clear resume
                </button>
              )}
            </div>
            {resumeFileError && <p role="alert" className="mt-2 text-xs text-red-600">{resumeFileError}</p>}
            <p className="fjf-muted mt-2 text-xs">Tip: PDFs can&apos;t be read here yet — open your PDF, copy the text, and paste it above.</p>
          </Card>

          {/* Projects */}
          <section aria-label="Projects" id="pf-projects">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">🚀 Projects <span className="fjf-muted font-normal text-sm">— weighted heavily in matching</span></h2>
              <button onClick={addProject} className="fjf-btn fjf-btn-ghost fjf-btn-sm">+ Add project</button>
            </div>
            <div className="mb-3">
              <GitHubImport
                existingTitles={p.projects.map((x) => x.title)}
                onImport={importGitHubProject}
              />
            </div>
            {p.projects.length === 0 && (
              <Card className="p-6 text-center">
                <p className="font-medium">Add your projects to make your matches more accurate.</p>
                <p className="fjf-muted mt-1 text-sm">Each project with a tech stack sharpens every match score.</p>
                <button onClick={addProject} className="fjf-btn fjf-btn-primary fjf-btn-sm mt-4">+ Add your first project</button>
              </Card>
            )}
            <div className="grid gap-3">
              {p.projects.map((proj, i) => {
                const open = editingProject === i;
                return (
                  <Card key={i} className="p-5">
                    {open ? (
                      <div className="grid gap-3">
                        <div>
                          <label className="fjf-label" htmlFor={`pj-title-${i}`}>Project name</label>
                          <input id={`pj-title-${i}`} className="fjf-input" value={proj.title} onChange={(e) => {
                            const next = [...p.projects]; next[i] = { ...next[i], title: e.target.value }; update("projects", next);
                          }} placeholder="AI Resume Analyzer" />
                        </div>
                        <div>
                          <label className="fjf-label" htmlFor={`pj-desc-${i}`}>Description</label>
                          <textarea id={`pj-desc-${i}`} className="fjf-textarea" rows={2} value={proj.description} onChange={(e) => {
                            const next = [...p.projects]; next[i] = { ...next[i], description: e.target.value }; update("projects", next);
                          }} placeholder="What it does + your role" />
                        </div>
                        <div>
                          <label className="fjf-label" htmlFor={`pj-tech-${i}`}>Technologies (comma separated)</label>
                          <input id={`pj-tech-${i}`} className="fjf-input" value={proj.techStack.join(", ")} onChange={(e) => {
                            const next = [...p.projects]; next[i] = { ...next[i], techStack: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }; update("projects", next);
                          }} placeholder="Python, FastAPI, React, SQL" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="fjf-label" htmlFor={`pj-link-${i}`}>GitHub URL</label>
                            <input id={`pj-link-${i}`} className="fjf-input" type="url" value={proj.link || ""} onChange={(e) => {
                              const next = [...p.projects]; next[i] = { ...next[i], link: e.target.value }; update("projects", next);
                            }} placeholder="https://github.com/you/project" />
                          </div>
                          <div>
                            <label className="fjf-label" htmlFor={`pj-demo-${i}`}>Demo URL</label>
                            <input id={`pj-demo-${i}`} className="fjf-input" type="url" value={proj.demoUrl || ""} onChange={(e) => {
                              const next = [...p.projects]; next[i] = { ...next[i], demoUrl: e.target.value }; update("projects", next);
                            }} placeholder="https://your-demo.com" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingProject(null)} className="fjf-btn fjf-btn-primary fjf-btn-sm">Done</button>
                          <button onClick={() => update("projects", p.projects.filter((_, j) => j !== i))} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Delete</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{proj.title || "Untitled project"}</p>
                            {proj.description && <p className="fjf-muted mt-1 text-sm leading-6">{proj.description}</p>}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button onClick={() => setEditingProject(i)} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Edit</button>
                            <button onClick={() => update("projects", p.projects.filter((_, j) => j !== i))} className="fjf-btn fjf-btn-ghost fjf-btn-sm" aria-label={`Delete ${proj.title || "project"}`}>Delete</button>
                          </div>
                        </div>
                        {proj.techStack.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {proj.techStack.map((t) => (
                              <span key={t} className="fjf-chip text-xs">{t}</span>
                            ))}
                          </div>
                        )}
                        {(proj.link || proj.demoUrl) && (
                          <div className="mt-2 flex gap-3 text-xs">
                            {proj.link && <a href={proj.link} target="_blank" rel="noreferrer" className="fjf-accent">GitHub ↗</a>}
                            {proj.demoUrl && <a href={proj.demoUrl} target="_blank" rel="noreferrer" className="fjf-accent">Demo ↗</a>}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Experience */}
          <section aria-label="Experience" id="pf-exp">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">💼 Experience <span className="fjf-muted font-normal text-sm">— internships, freelance, clubs</span></h2>
              <button onClick={addExperience} className="fjf-btn fjf-btn-ghost fjf-btn-sm">+ Add experience</button>
            </div>
            {p.experience.length === 0 && (
              <Card className="p-6 text-center">
                <p className="font-medium">No experience yet? That&apos;s fine for a fresher.</p>
                <p className="fjf-muted mt-1 text-sm">Any internship, freelance gig, or club role sharpens matching and your resume.</p>
                <button onClick={addExperience} className="fjf-btn fjf-btn-primary fjf-btn-sm mt-4">+ Add experience</button>
              </Card>
            )}
            <div className="grid gap-3">
              {p.experience.map((exp, i) => {
                const open = editingExp === i;
                return (
                  <Card key={i} className="p-5">
                    {open ? (
                      <div className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="fjf-label" htmlFor={`exp-title-${i}`}>Role / title</label>
                            <input id={`exp-title-${i}`} className="fjf-input" value={exp.title} onChange={(e) => {
                              const next = [...p.experience]; next[i] = { ...next[i], title: e.target.value }; update("experience", next);
                            }} placeholder="Web Dev Intern" />
                          </div>
                          <div>
                            <label className="fjf-label" htmlFor={`exp-org-${i}`}>Organization</label>
                            <input id={`exp-org-${i}`} className="fjf-input" value={exp.org} onChange={(e) => {
                              const next = [...p.experience]; next[i] = { ...next[i], org: e.target.value }; update("experience", next);
                            }} placeholder="College club / Startup" />
                          </div>
                        </div>
                        <div>
                          <label className="fjf-label" htmlFor={`exp-desc-${i}`}>What you did</label>
                          <textarea id={`exp-desc-${i}`} className="fjf-textarea" rows={3} value={exp.description} onChange={(e) => {
                            const next = [...p.experience]; next[i] = { ...next[i], description: e.target.value }; update("experience", next);
                          }} placeholder="Built X with Y; improved Z by …; worked with a team of N." />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingExp(null)} className="fjf-btn fjf-btn-primary fjf-btn-sm">Done</button>
                          <button onClick={() => update("experience", p.experience.filter((_, j) => j !== i))} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Delete</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{exp.title || "Untitled role"}{exp.org ? ` — ${exp.org}` : ""}</p>
                          {exp.description && <p className="fjf-muted mt-1 text-sm leading-6">{exp.description}</p>}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button onClick={() => setEditingExp(i)} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Edit</button>
                          <button onClick={() => update("experience", p.experience.filter((_, j) => j !== i))} className="fjf-btn fjf-btn-ghost fjf-btn-sm" aria-label={`Delete ${exp.title || "experience"}`}>Delete</button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-5">
            <Kicker>Profile strength</Kicker>
            <p className="fjf-match-ring mt-2 text-3xl font-bold">{strength.score}%</p>
            <div className="mt-3"><Progress value={strength.score} /></div>
            <ul className="mt-3 space-y-1.5 text-xs leading-5 text-[#475569]">
              {strength.tips.map((t) => (
                <li key={t} className="flex gap-1.5"><span aria-hidden className="fjf-accent">▸</span>{t}</li>
              ))}
              {strength.tips.length === 0 && <li>Complete — your matches will be sharp.</li>}
            </ul>
          </Card>
          <Card className="p-5">
            <button onClick={save} className="fjf-btn fjf-btn-primary w-full">Save profile</button>
            <Link href="/jobs" className="fjf-btn fjf-btn-ghost mt-2 w-full">Find jobs →</Link>
            <p role="status" className="mt-3 text-center text-xs">
              {saved ? (
                <span className="fjf-accent">Saved ✓{lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString()}` : ""} · autosave on</span>
              ) : (
                <span className="text-amber-700">Saving…</span>
              )}
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">🔒 Your data</h2>
            <p className="fjf-muted mt-1 text-xs leading-5">
              Everything lives in this browser only — no account, nothing uploaded. Export a backup or wipe it any time.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={exportData} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Export</button>
              {!confirmWipe ? (
                <button onClick={() => setConfirmWipe(true)} className="fjf-btn fjf-btn-ghost fjf-btn-sm">Wipe…</button>
              ) : (
                <button onClick={wipeData} className="fjf-btn fjf-btn-ghost fjf-btn-sm !border-red-300 !text-red-600">Confirm wipe</button>
              )}
            </div>
            {confirmWipe && (
              <button onClick={() => setConfirmWipe(false)} className="fjf-muted mt-2 w-full text-center text-xs underline">
                Keep my data
              </button>
            )}
          </Card>
        </aside>
      </div>
    </main>
  );
}
