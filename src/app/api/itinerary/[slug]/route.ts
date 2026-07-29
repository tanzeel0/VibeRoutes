import { NextRequest, NextResponse } from "next/server";
import { getItineraryBySlug } from "@/lib/db/queries/itinerary";
import { PUBLIC_ERRORS } from "@/lib/security/sanitize";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = rateLimit({
    key: clientKey(req, "itinerary"),
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: PUBLIC_ERRORS.rateLimited },
      { status: 429 }
    );
  }

  const { slug } = await params;

  // Reject obviously abusive slug shapes
  if (!slug || slug.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ error: PUBLIC_ERRORS.notFound }, { status: 404 });
  }

  const itinerary = await getItineraryBySlug(slug);

  if (!itinerary) {
    return NextResponse.json({ error: PUBLIC_ERRORS.notFound }, { status: 404 });
  }

  return NextResponse.json(itinerary, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
