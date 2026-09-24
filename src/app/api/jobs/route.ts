import { NextResponse } from "next/server";
import { fetchJobsForProfile } from "@/lib/jobs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobs, source, broadFallback, hasMore } = await fetchJobsForProfile({
      country: body.country || "in",
      city: body.city || "",
      remoteOnly: !!body.remoteOnly,
      jobType: body.jobType || "internship",
      skills: Array.isArray(body.skills) ? body.skills : [],
      query: body.query || "",
      page: typeof body.page === "number" ? body.page : 1,
    });
    return NextResponse.json({ jobs, source, broadFallback: !!broadFallback, hasMore: !!hasMore });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "job fetch failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const { jobs, source } = await fetchJobsForProfile({
    country: "in",
    city: "",
    remoteOnly: false,
    jobType: "internship",
    skills: ["react"],
  });
  return NextResponse.json({ jobs, source });
}
