import { prisma } from "../prismaClient";
import type { ItineraryPayload } from "@/types/itinerary";

function normalizeArray(arr: string[]): string[] {
  return arr.map((s) => s.toLowerCase().trim()).sort();
}

function arraysOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  const overlap = a.filter((x) => setB.has(x));
  return overlap.length / Math.max(a.length, 1);
}

export async function findCachedItinerary(
  origin: string,
  destination: string,
  vibePrimary: string,
  interests: string[]
): Promise<ItineraryPayload | null> {
  const results = await prisma.itinerary.findMany({
    where: {
      origin: { equals: origin, mode: "insensitive" },
      destination: { equals: destination, mode: "insensitive" },
      vibePrimary: { equals: vibePrimary, mode: "insensitive" },
    },
    orderBy: { hitCount: "desc" },
    take: 5,
  });

  const normalizedInterests = normalizeArray(interests);

  for (const row of results) {
    const storedInterests = (row.interests as string[]) || [];
    const overlap = arraysOverlap(normalizedInterests, normalizeArray(storedInterests));
    if (overlap >= 0.5) {
      await prisma.itinerary.update({
        where: { id: row.id },
        data: { hitCount: { increment: 1 } },
      });
      return row.payload as unknown as ItineraryPayload;
    }
  }

  return null;
}

export async function saveItinerary(payload: ItineraryPayload): Promise<void> {
  const existing = await prisma.itinerary.findUnique({
    where: { slug: payload.slug },
  });

  if (existing) {
    await prisma.itinerary.update({
      where: { slug: payload.slug },
      data: {
        payload: JSON.parse(JSON.stringify(payload)),
        hitCount: { increment: 1 },
      },
    });
  } else {
    await prisma.itinerary.create({
      data: {
        slug: payload.slug,
        source: payload.source,
        origin: payload.origin,
        destination: payload.destination,
        vibePrimary: payload.vibe.primary,
        vibeSecondary: payload.vibe.secondary,
        purpose: payload.purpose,
        interests: payload.interests,
        durationDays: payload.duration.days,
        payload: JSON.parse(JSON.stringify(payload)),
      },
    });
  }
}

export async function getItineraryBySlug(
  slug: string
): Promise<ItineraryPayload | null> {
  const row = await prisma.itinerary.findUnique({ where: { slug } });
  if (!row) return null;

  await prisma.itinerary.update({
    where: { slug },
    data: { hitCount: { increment: 1 } },
  });

  return row.payload as unknown as ItineraryPayload;
}

export async function getPopularItineraries(limit = 6) {
  const rows = await prisma.itinerary.findMany({
    orderBy: { hitCount: "desc" },
    take: limit,
    select: {
      slug: true,
      origin: true,
      destination: true,
      vibePrimary: true,
      hitCount: true,
      payload: true,
    },
  });

  return rows.map((row) => {
    const p = row.payload as unknown as ItineraryPayload;
    return {
      slug: row.slug,
      title: p.title,
      origin: row.origin,
      destination: row.destination,
      vibe_primary: row.vibePrimary,
      hero_image: p.hero_image,
      hit_count: row.hitCount,
      route_summary: p.route_summary,
      duration: p.duration,
    };
  });
}
