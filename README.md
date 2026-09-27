# Launchly — Launching Your Career

Skill-matched internships for freshers, with transparent match scores and AI-tailored resumes.

**How it works:** build your profile (skills, projects, experience, existing resume) → get jobs matched against real requirements with match % and reasons → generate a resume + cover letter tailored to the exact job → apply and track it in your pipeline.

## Run it locally

Prereqs: **Node.js 20+** and npm.

```bash
git clone https://github.com/syeD-de/launchly.git
cd launchly
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Works immediately with zero keys
(rule-based tailoring + no-key job sources + labeled samples).

## Full experience (optional keys)

Copy `.env.example` to `.env.local` and fill what you have:

| Key | Where | What it unlocks | Cost |
|---|---|---|---|
| `GEMINI_API_KEY` | [AI Studio](https://aistudio.google.com) (free, no billing) | AI resumes + cover letters | Free tier |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com) | Best-quality resumes (takes priority) | Paid |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | [Adzuna Developers](https://developer.adzuna.com) | Live country-targeted jobs + salary + dates | Free tier |

Engine priority: Claude → Gemini → local fallback. Never commit real keys — `.env*` is git-ignored.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build (must pass before deploy)
- `npm start` — serve the production build
- `npm run lint` — eslint

## Deploy

Import `syeD-de/launchly` on [Vercel](https://vercel.com) (Next.js preset), add the
env vars above in the dashboard, Deploy. No database needed — profiles live in the browser.

## Stack

Next.js 16 · React 19 · Tailwind 4 · Prisma schema included (unused at runtime — local-first by design)
