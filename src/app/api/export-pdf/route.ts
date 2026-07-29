import { NextRequest, NextResponse } from "next/server";
import { getItineraryBySlug } from "@/lib/db/queries/itinerary";
import { buildItineraryPdfHtml } from "@/lib/exportPdf";
import type { DayItinerary, ItineraryPayload } from "@/types/itinerary";
import { PUBLIC_ERRORS } from "@/lib/security/sanitize";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

async function loadItinerary(slug: string | null) {
  if (!slug || slug.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  return getItineraryBySlug(slug);
}

function respondPdf(itinerary: ItineraryPayload) {
  const days: DayItinerary[] = itinerary.itinerary || [];
  return new Response(buildItineraryPdfHtml(itinerary, days), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(req: NextRequest) {
  const limited = rateLimit({
    key: clientKey(req, "export-pdf"),
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: PUBLIC_ERRORS.rateLimited },
      { status: 429 }
    );
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: PUBLIC_ERRORS.validation }, { status: 400 });
  }

  const itinerary = await loadItinerary(slug);
  if (!itinerary) {
    return NextResponse.json({ error: PUBLIC_ERRORS.notFound }, { status: 404 });
  }

  return respondPdf(itinerary as ItineraryPayload);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit({
    key: clientKey(req, "export-pdf"),
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: PUBLIC_ERRORS.rateLimited },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const itinerary = await loadItinerary(slug);

  if (!slug) {
    return NextResponse.json({ error: PUBLIC_ERRORS.validation }, { status: 400 });
  }
  if (!itinerary) {
    return NextResponse.json({ error: PUBLIC_ERRORS.notFound }, { status: 404 });
  }

  return respondPdf(itinerary as ItineraryPayload);
}
