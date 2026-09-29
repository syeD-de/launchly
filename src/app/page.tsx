import Link from "next/link";
import { Card, Kicker, MatchBadge } from "@/components/ui";

const FLOW = ["Your profile", "AI match", "Internship"];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      {/* Hero */}
      <section className="relative mx-auto max-w-2xl pt-14 text-center sm:pt-20">
        <div aria-hidden className="fjf-orb left-[-120px] top-[-40px] h-64 w-64 bg-[#10b981]/25" />
        <div aria-hidden className="fjf-orb right-[-110px] top-[60px] h-56 w-56 bg-[#0ea5e9]/20" style={{ animationDelay: "-4s" }} />
        <Kicker>
          <span className="fjf-chip">AI-matched internships for freshers</span>
        </Kicker>
        <h1 className="fjf-enter mt-4 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
          Find internships that <span className="fjf-gradient-text">actually fit you.</span>
        </h1>
        <p className="fjf-enter fjf-muted mx-auto mt-4 max-w-xl text-base leading-7 sm:text-lg" style={{ animationDelay: "90ms" }}>
          Your skills + projects → matched against real job requirements.
          See exactly why you fit, then generate a tailored resume.
        </p>
        <div className="fjf-enter mt-7 flex flex-col justify-center gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
          <Link href="/profile" className="fjf-btn fjf-btn-primary">
            Build my profile
          </Link>
          <Link href="/jobs" className="fjf-btn fjf-btn-ghost">
            Explore internships
          </Link>
        </div>
        <p className="fjf-muted mt-4 text-xs">Free for freshers · No spam · Match % on every job</p>
      </section>

      {/* Workflow visual */}
      <section className="mx-auto mt-12 max-w-3xl" aria-label="How it works">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
          {FLOW.map((step, i) => (
            <span key={step} className="flex items-center gap-2 sm:gap-3">
              <span className={`fjf-chip ${i === 1 ? "fjf-chip-hit" : ""}`}>{step}</span>
              {i < FLOW.length - 1 && <span aria-hidden className="fjf-muted">→</span>}
            </span>
          ))}
        </div>

        <Card hover className="fjf-enter mx-auto mt-5 max-w-md p-5 text-left" style={{ animationDelay: "260ms" }}>
          <p className="fjf-kicker">Example match card</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">AI/ML Intern</p>
              <p className="fjf-muted text-sm">Example Company · Bengaluru · Internship</p>
            </div>
            <MatchBadge score={92} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Python", "SQL", "Machine Learning"].map((s) => (
              <span key={s} className="fjf-chip fjf-chip-hit text-xs">✓ {s}</span>
            ))}
            <span className="fjf-chip text-xs">⚠ Docker</span>
          </div>
          <p className="fjf-muted mt-3 text-xs">Visual example only — your real matches appear on the Jobs page.</p>
        </Card>
      </section>

      {/* Features */}
      <section className="mt-14 grid gap-4 sm:grid-cols-3" aria-label="Features">
        <Card className="fjf-enter p-6" style={{ animationDelay: "80ms" }}>
          <p className="text-xl" aria-hidden>🌍</p>
          <h2 className="mt-2 font-semibold">User-targeted market</h2>
          <p className="fjf-muted mt-1.5 text-sm leading-6">
            Jobs are targeted by your country, city, and remote preference — so a fresher in Bengaluru and one in Toronto see different markets.
          </p>
        </Card>
        <Card className="fjf-enter p-6" style={{ animationDelay: "160ms" }}>
          <p className="text-xl" aria-hidden>⚖️</p>
          <h2 className="mt-2 font-semibold">Skills + projects matching</h2>
          <p className="fjf-muted mt-1.5 text-sm leading-6">
            Every job is scored against your skills, project technologies, and experience — with matched and missing skills shown transparently.
          </p>
        </Card>
        <Card className="fjf-enter p-6" style={{ animationDelay: "240ms" }}>
          <p className="text-xl" aria-hidden>✨</p>
          <h2 className="mt-2 font-semibold">AI resume tailoring</h2>
          <p className="fjf-muted mt-1.5 text-sm leading-6">
            Generate a resume customized for the exact job you pick — relevant skills first, best project highlighted, ATS-friendly.
          </p>
        </Card>
      </section>

      {/* Promise strip */}
      <section className="mt-10" aria-label="Promise">
        <Card className="p-6 text-center sm:p-8">
          <p className="fjf-kicker">Profile → Match → Why you match → Tailored resume → Apply</p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#475569]">
            Tell us what you can build → we&apos;ll find jobs that fit you, and show you exactly why.
          </p>
          <Link href="/dashboard" className="fjf-btn fjf-btn-ghost mt-5">
            See your dashboard →
          </Link>
        </Card>
      </section>
    </main>
  );
}
