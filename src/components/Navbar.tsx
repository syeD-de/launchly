"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadProfileLocal } from "@/lib/resume";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/profile", label: "Profile" },
  { href: "/resume", label: "Resumes" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const p = loadProfileLocal();
      if (p?.name) setName(p.name);
    } catch {
      // ignore
    }
  }, [pathname]);

  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-[#1c1c1c] bg-[#080808]/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#10b981] text-sm text-[#04120c]">◈</span>
          <span className="text-[15px]">Launchly</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href === "/resume" && pathname === "/resumes");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-[#101010] text-[#f5f5f5] shadow-[inset_0_0_0_1px_#262626]" : "text-[#8a8a8a] hover:text-[#f5f5f5]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {name ? (
            <Link href="/profile" className="flex items-center gap-2 text-sm" title="View profile">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] text-sm font-bold text-[#10b981] shadow-[inset_0_0_0_1px_#2a2a2a]">
                {initial || "•"}
              </span>
              <span className="max-w-28 truncate text-[#c9c9c9]">{name.split(" ")[0]}</span>
            </Link>
          ) : (
            <Link href="/profile" className="fjf-btn fjf-btn-primary fjf-btn-sm">
              Build my profile
            </Link>
          )}
        </div>

        <button
          className="fjf-btn fjf-btn-ghost fjf-btn-sm md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>

      {open && (
        <div className="border-t border-[#1c1c1c] px-4 py-3 md:hidden">
          <div className="grid gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                  pathname === l.href ? "bg-[#141414] text-white" : "text-[#8a8a8a]"
                }`}
              >
                {l.label}
              </Link>
            ))}
            {!name && (
              <Link href="/profile" onClick={() => setOpen(false)} className="fjf-btn fjf-btn-primary mt-2">
                Build my profile
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
