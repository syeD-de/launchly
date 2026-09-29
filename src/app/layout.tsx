import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Launchly — Launching Your Career",
  description: "Tell us what you can build. Launchly finds internships that fit you, explains why, and tailors your resume.",
  openGraph: {
    title: "Launchly — Launching Your Career",
    description: "Skill-matched internships for freshers, with transparent match scores and tailored resumes.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Launchly",
    description: "Launching your career — skill-matched internships for freshers.",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#10b981] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#04120c]"
        >
          Skip to content
        </a>
        <Navbar />
        <div className="flex-1" id="main-content">{children}</div>
        <footer className="border-t border-[#e5e7eb]">
          <p className="fjf-muted mx-auto max-w-5xl px-6 py-5 text-xs">
            Launchly — Launching Your Career. Profile → match → why you match → tailored resume → apply.
          </p>
        </footer>
      </body>
    </html>
  );
}
