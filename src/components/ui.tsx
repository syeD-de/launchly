"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

export function Card({ children, className = "", hover = false, style }: { children: ReactNode; className?: string; hover?: boolean; style?: CSSProperties }) {
  return (
    <div className={`fjf-card ${hover ? "fjf-card-hover" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="fjf-kicker">{children}</p>;
}

export function MatchBadge({ score, large = false }: { score: number; large?: boolean }) {
  const p = Math.max(0, Math.min(100, Math.round(score)));
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const size = large ? 76 : 58;
  const stroke = large ? 6 : 5;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const color = p >= 70 ? "#10b981" : p >= 45 ? "#d4d4d4" : "#6f6f6f";
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      role="img"
      aria-label={`Match score ${p} percent`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="fjf-ring-svg -rotate-90" aria-hidden>
        <circle
          className="fjf-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="fjf-ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={on ? c * (1 - p / 100) : c}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <strong className={`fjf-match-ring ${large ? "text-lg" : "text-sm"}`}>{p}%</strong>
        <span className="fjf-muted text-[9px] font-medium uppercase tracking-wider">match</span>
      </span>
    </span>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="fjf-muted">{label}</span>
          <span className="fjf-match-ring font-semibold">{v}%</span>
        </div>
      )}
      <div className="fjf-track" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label || "progress"}>
        <div className="fjf-fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function BreakdownBar({ label, value }: { label: string; value: number }) {
  return <Progress value={value} label={`${label} — ${Math.round(value)}%`} />;
}

export function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <Card className="p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="fjf-muted mx-auto mt-2 max-w-md text-sm leading-6">{body}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="fjf-btn fjf-btn-primary mt-5">
          {ctaLabel}
        </Link>
      )}
    </Card>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="fjf-card p-5" aria-hidden>
      <div className="fjf-skeleton h-5 w-2/3" />
      <div className="fjf-skeleton mt-2 h-4 w-1/3" />
      <div className="fjf-skeleton mt-4 h-12 w-full" />
      <div className="mt-3 flex gap-2">
        <div className="fjf-skeleton h-6 w-16" />
        <div className="fjf-skeleton h-6 w-16" />
        <div className="fjf-skeleton h-6 w-16" />
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-[#f87171]">
      {message}
    </p>
  );
}
