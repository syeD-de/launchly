import Link from "next/link";
import { Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <Card className="p-8">
        <p className="text-4xl" aria-hidden>🧭</p>
        <h1 className="mt-3 text-xl font-bold">This page doesn&apos;t exist.</h1>
        <p className="fjf-muted mx-auto mt-2 max-w-md text-sm leading-6">
          The link may be old, or a shared job may have expired from the market.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/jobs" className="fjf-btn fjf-btn-primary fjf-btn-sm">Find jobs →</Link>
          <Link href="/" className="fjf-btn fjf-btn-ghost fjf-btn-sm">Home</Link>
        </div>
      </Card>
    </main>
  );
}
