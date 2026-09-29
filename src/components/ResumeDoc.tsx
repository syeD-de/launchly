"use client";

import type { ReactNode } from "react";

export interface DocSection {
  heading: string;
  body: string;
}

/** Split generated text on "### 1. TITLE" markers (Claude + fallback share them). */
export function splitSections(text: string): DocSection[] {
  const parts = text.split(/^###\s*\d+\.\s*(.+)$/gm);
  const out: DocSection[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const body = (parts[i + 1] || "").trim();
    if (body) out.push({ heading: (parts[i] || "").trim(), body });
  }
  if (!out.length) return [{ heading: "", body: text.trim() }];
  return out;
}

function isContactLine(line: string): boolean {
  if (line.length > 110) return false;
  return /[@|]|phone:|linkedin|github|https?:|,[A-Za-z ]+$/.test(line) || /^\S+@\S+\.\S+$/.test(line);
}

function isHeading(line: string): boolean {
  const t = line.trim();
  return t.length >= 3 && t.length <= 42 && /^[A-Z][A-Z .\-/&()]+$/.test(t) && /[A-Z]{3}/.test(t);
}

/** Render the FINAL RESUME section like a real document, not a terminal dump. */
function ResumeBody({ body }: { body: string }) {
  const lines = body.split("\n").map((l) => l.replace(/\s+$/, ""));
  const blocks: { kind: "name" | "contact" | "heading" | "bullet" | "para"; text: string }[] = [];
  let seenName = false;
  let contactDone = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!seenName) {
      blocks.push({ kind: "name", text: line });
      seenName = true;
      continue;
    }
    if (!contactDone && isContactLine(line)) {
      blocks.push({ kind: "contact", text: line });
      continue;
    }
    contactDone = true;
    if (isHeading(line)) {
      blocks.push({ kind: "heading", text: line });
    } else if (/^[-*•]\s+/.test(line)) {
      blocks.push({ kind: "bullet", text: line.replace(/^[-*•]\s+/, "") });
    } else {
      blocks.push({ kind: "para", text: line });
    }
  }
  // Group consecutive bullets into one <ul>.
  const els: ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: number) => {
    if (list.length) {
      els.push(
        <ul key={`ul-${key}`} className="mt-1.5 space-y-1.5">
          {list.map((b, j) => (
            <li key={j} className="flex gap-2 text-[13px] leading-6 text-[#334155]">
              <span aria-hidden className="fjf-accent shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  blocks.forEach((b, i) => {
    if (b.kind === "bullet") {
      list.push(b.text);
      return;
    }
    flush(i);
    if (b.kind === "name") {
      els.push(
        <p key={i} className="text-center text-xl font-bold tracking-tight text-[#0f172a]">
          {b.text}
        </p>
      );
    } else if (b.kind === "contact") {
      els.push(
        <p key={i} className="fjf-muted text-center text-xs">
          {b.text}
        </p>
      );
    } else if (b.kind === "heading") {
      els.push(
        <p key={i} className="fjf-accent mt-5 text-xs font-bold uppercase tracking-[0.14em]">
          {b.text}
        </p>
      );
      els.push(<div key={`rule-${i}`} aria-hidden className="mb-2 mt-1 border-t border-[#e2e8f0]" />);
    } else {
      els.push(
        <p key={i} className="mt-1.5 text-[13px] leading-6 text-[#334155]">
          {b.text}
        </p>
      );
    }
  });
  flush(blocks.length);
  return <div className="px-6 py-6">{els}</div>;
}

/** Full generated document: the submittable resume + clearly-separated private notes. */
export function GeneratedDoc({ text }: { text: string }) {
  const sections = splitSections(text);
  const [first, ...rest] = sections;
  return (
    <div className="space-y-4">
      <div>
        <p className="fjf-kicker mb-2 no-print">
          <span className="fjf-accent">📄 Submit this part</span> · {first.heading || "Resume"}
        </p>
        <div className="fjf-card print-doc overflow-hidden">
          <ResumeBody body={first.body} />
        </div>
      </div>
      {rest.length > 0 && (
        <p className="fjf-kicker no-print">
          🔒 Private coaching notes — <span className="text-amber-700">do NOT submit these</span>, they&apos;re advice for you only
        </p>
      )}
      {rest.map((s) => (
        <div key={s.heading}>
          <p className="fjf-kicker mb-2">{s.heading}</p>
          <div className="fjf-card p-5">
            {/^-\s+/m.test(s.body) ? (
              <ul className="space-y-2 text-sm leading-6 text-[#475569]">
                {s.body
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden className="fjf-accent shrink-0">▸</span>
                      <span>{l.replace(/^[-*•]\s+/, "")}</span>
                    </li>
                  ))}
              </ul>
            ) : /gaps/i.test(s.heading) && s.body.includes(",") ? (
              <div className="flex flex-wrap gap-1.5">
                {s.body.split(/[,\n]+/).map((g) => g.trim()).filter(Boolean).map((g) => (
                  <span key={g} className="fjf-chip text-xs">⚠ {g}</span>
                ))}
              </div>
            ) : (
              s.body.split(/\n+/).map((p, i) => (
                <p key={i} className="mt-2 text-sm leading-6 text-[#475569] first:mt-0">
                  {p}
                </p>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
