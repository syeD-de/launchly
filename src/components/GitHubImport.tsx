"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import type { UserProfile } from "@/lib/types";

interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  fork: boolean;
}

function usernameFrom(input: string): string {
  const t = input.trim().replace(/\/$/, "");
  const m = t.match(/github\.com\/([A-Za-z0-9-]+)/i);
  if (m) return m[1];
  return t.replace(/^@/, "");
}

export default function GitHubImport({
  existingTitles,
  onImport,
}: {
  existingTitles: string[];
  onImport: (proj: UserProfile["projects"][number], skillHints: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [fetchedFor, setFetchedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imported, setImported] = useState<Set<string>>(new Set());

  async function fetchRepos() {
    const user = usernameFrom(input);
    if (!user) {
      setError("Enter your GitHub username or profile URL.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=12`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
      );
      if (res.status === 404) throw new Error("not-found");
      if (res.status === 403) throw new Error("rate-limit");
      if (!res.ok) throw new Error("fetch-failed");
      const data = (await res.json()) as Repo[];
      const own = data.filter((r) => !r.fork).slice(0, 10);
      setRepos(own);
      setFetchedFor(user);
      if (!own.length) setError("No public repositories found for this user.");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg === "not-found"
          ? "GitHub user not found. Check the username."
          : msg === "rate-limit"
            ? "GitHub rate limit hit. Try again in a few minutes."
            : "Couldn't reach GitHub. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function importRepo(r: Repo) {
    const tech = [r.language].filter(Boolean) as string[];
    onImport(
      {
        title: r.name.replace(/[-_]+/g, " "),
        description: r.description || "",
        techStack: tech,
        link: r.html_url,
        demoUrl: r.homepage || "",
      },
      tech
    );
    setImported((prev) => new Set(prev).add(r.html_url));
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">⬇ Import from GitHub</h3>
      <p className="fjf-muted mt-1 text-xs leading-5">
        Enter your GitHub username — we pull your public repos (name, description, main language, links) so you can add them as projects in one click.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); void fetchRepos(); }}
      >
        <input
          className="fjf-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="octocat or https://github.com/octocat"
          aria-label="GitHub username or URL"
          autoComplete="off"
        />
        <button type="submit" className="fjf-btn fjf-btn-ghost fjf-btn-sm shrink-0" disabled={loading}>
          {loading ? "Fetching…" : "Fetch repos"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-[#f87171]">{error}</p>}

      {repos.length > 0 && (
        <ul className="mt-3 space-y-2">
          {repos.map((r) => {
            const already =
              imported.has(r.html_url) ||
              existingTitles.some((t) => t.toLowerCase() === r.name.replace(/[-_]+/g, " ").toLowerCase());
            return (
              <li key={r.html_url} className="flex items-center justify-between gap-3 rounded-lg border border-[#1c1c1c] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="fjf-muted truncate text-xs">
                    {[r.language, r.description].filter(Boolean).join(" · ") || "No description"}
                  </p>
                </div>
                <button
                  type="button"
                  className="fjf-btn fjf-btn-ghost fjf-btn-sm shrink-0"
                  disabled={already}
                  onClick={() => importRepo(r)}
                >
                  {already ? "Added ✓" : "+ Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {fetchedFor && !repos.length && !error && !loading && (
        <p className="fjf-muted mt-2 text-xs">Fetched @{fetchedFor}.</p>
      )}
    </Card>
  );
}
