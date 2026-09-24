"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <Card className="p-8">
        <p className="text-4xl" aria-hidden>😵</p>
        <h1 className="mt-3 text-xl font-bold">Something broke on our side.</h1>
        <p className="fjf-muted mx-auto mt-2 max-w-md text-sm leading-6">
          Your profile and saved jobs are stored locally in this browser — nothing was lost.
          Try again, or head back to safety.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => reset()} className="fjf-btn fjf-btn-primary fjf-btn-sm">Try again</button>
          <Link href="/dashboard" className="fjf-btn fjf-btn-ghost fjf-btn-sm">Dashboard →</Link>
        </div>
      </Card>
    </main>
  );
}
