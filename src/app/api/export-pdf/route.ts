import { NextRequest, NextResponse } from "next/server";
import { getItineraryBySlug } from "@/lib/db/queries/itinerary";
import { buildItineraryPdfHtml } from "@/lib/exportPdf";
import type { DayItinerary, ItineraryPayload } from "@/types/itinerary";

export const runtime = "nodejs";

async function loadItinerary(slug: string | null) {
  if (!slug) return null;
  return getItineraryBySlug(slug);
}

function respondPdf(itinerary: ItineraryPayload) {
  const days: DayItinerary[] = itinerary.itinerary || [];
  return new Response(buildItineraryPdfHtml(itinerary, days), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const itinerary = await loadItinerary(slug);

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (!itinerary) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }

  return respondPdf(itinerary as ItineraryPayload);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const itinerary = await loadItinerary(slug);

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (!itinerary) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }

  return respondPdf(itinerary as ItineraryPayload);
}
