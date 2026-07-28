import { NextResponse } from "next/server";
import { getPopularItineraries } from "@/lib/db/queries/itinerary";

export const runtime = "nodejs";

export async function GET() {
  try {
    const routes = await getPopularItineraries(6);
    return NextResponse.json(routes);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
