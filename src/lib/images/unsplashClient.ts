import { prisma } from "../db/prismaClient";
import type { DayItinerary, ImageAsset } from "@/types/itinerary";

export interface UnsplashResult {
  url: string;
  alt: string;
  credit: string;
  photoId?: string;
}

async function readCache(queryKey: string): Promise<UnsplashResult | null> {
  try {
    const cached = await prisma.imageCache.findUnique({ where: { queryKey } });
    if (!cached) return null;
    return {
      url: cached.url,
      alt: cached.alt || queryKey,
      credit: cached.credit || "Unsplash",
    };
  } catch {
    return null;
  }
}

async function writeCache(queryKey: string, result: UnsplashResult): Promise<void> {
  try {
    await prisma.imageCache.upsert({
      where: { queryKey },
      update: { url: result.url, alt: result.alt, credit: result.credit },
      create: {
        queryKey,
        url: result.url,
        alt: result.alt,
        credit: result.credit,
      },
    });
  } catch {
    /* cache is best-effort */
  }
}

function buildQueries(seed: string, destination: string): string[] {
  const base = seed.trim();
  const city = destination.trim();
  const queries = [
    `${base} ${city}`,
    `${base} ${city} india`,
    `${city} ${base}`,
    `${city} travel`,
    `${city} india tourism`,
    `${city} landscape`,
    `${city} street`,
    `india ${city}`,
    "india travel landscape",
  ];
  // de-dupe while preserving order
  return [...new Set(queries.map((q) => q.toLowerCase().replace(/\s+/g, " ").trim()))];
}

async function searchUnsplash(
  query: string,
  page = 1,
  perPage = 8
): Promise<UnsplashResult[]> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) return [];

  try {
    const url =
      `https://api.unsplash.com/search/photos` +
      `?query=${encodeURIComponent(query)}` +
      `&per_page=${perPage}&page=${page}&orientation=landscape`;

    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${apiKey}` },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .map((photo: {
        id?: string;
        urls?: { regular?: string; small?: string };
        alt_description?: string;
        user?: { name?: string };
      }) => {
        const src = photo.urls?.regular || photo.urls?.small;
        if (!src) return null;
        return {
          url: src,
          alt: photo.alt_description || query,
          credit: photo.user?.name
            ? `Photo by ${photo.user.name} on Unsplash`
            : "Unsplash",
          photoId: photo.id,
        } as UnsplashResult;
      })
      .filter(Boolean) as UnsplashResult[];
  } catch {
    return [];
  }
}

/**
 * Fetch one Unsplash image for a query, trying fallbacks until something hits.
 * Pass `excludeIds` to avoid reusing the same photo across day cards.
 */
export async function fetchImage(
  query: string,
  options?: { destination?: string; excludeIds?: Set<string> }
): Promise<UnsplashResult | null> {
  const destination = options?.destination || "";
  const excludeIds = options?.excludeIds || new Set<string>();
  const queries = buildQueries(query, destination || query);

  for (const q of queries) {
    const cacheKey = q;
    const cached = await readCache(cacheKey);
    if (cached) {
      // Cached rows may not have photoId — still usable if URL isn't excluded
      const idGuess = cached.url;
      if (![...excludeIds].some((id) => cached.url.includes(id) || id === idGuess)) {
        return cached;
      }
    }

    const photos = await searchUnsplash(q, 1, 10);
    for (const photo of photos) {
      if (photo.photoId && excludeIds.has(photo.photoId)) continue;
      if ([...excludeIds].some((id) => photo.url.includes(id))) continue;
      await writeCache(cacheKey, photo);
      return photo;
    }
  }

  // Last resort: destination-only / india travel without exclude filter
  const fallbacks = await searchUnsplash(
    destination ? `${destination} india` : "india travel",
    1,
    12
  );
  return fallbacks[0] || null;
}

/**
 * Ensure every day has a unique Unsplash photo. Always fills missing images;
 * refreshes days that somehow lost theirs.
 */
export async function ensureDayImages(
  days: DayItinerary[],
  destination: string
): Promise<DayItinerary[]> {
  const used = new Set<string>();
  const result: DayItinerary[] = [];

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day.image?.url) {
      used.add(day.image.url);
      // keep photo id-ish tokens from unsplash urls when present
      const m = day.image.url.match(/photo-([a-z0-9-]+)/i);
      if (m) used.add(m[1]);
      result.push(day);
      continue;
    }

    const seeds = [
      day.activities?.[0]?.name,
      day.activities?.[1]?.name,
      day.location,
      day.title,
      `${destination} day ${day.day}`,
      `${destination} travel ${i + 1}`,
    ].filter(Boolean) as string[];

    let image: ImageAsset | undefined;
    for (const seed of seeds) {
      const photo = await fetchImage(seed, { destination, excludeIds: used });
      if (photo) {
        if (photo.photoId) used.add(photo.photoId);
        used.add(photo.url);
        image = {
          url: photo.url,
          alt: photo.alt || `${destination} — Day ${day.day}`,
          credit: photo.credit,
        };
        break;
      }
    }

    // Absolute last resort: page through destination search so each day differs
    if (!image) {
      const pool = await searchUnsplash(`${destination} india travel`, i + 1, 8);
      const pick =
        pool.find((p) => !p.photoId || !used.has(p.photoId)) || pool[0];
      if (pick) {
        if (pick.photoId) used.add(pick.photoId);
        used.add(pick.url);
        image = {
          url: pick.url,
          alt: pick.alt || `${destination} — Day ${day.day}`,
          credit: pick.credit,
        };
      }
    }

    result.push(image ? { ...day, image } : day);
  }

  return result;
}

/** Hero image for the trip cover / PDF. */
export async function ensureHeroImage(
  destination: string,
  existing?: ImageAsset
): Promise<ImageAsset | undefined> {
  if (existing?.url) return existing;
  const photo = await fetchImage(`${destination} travel`, { destination });
  if (!photo) return undefined;
  return {
    url: photo.url,
    alt: photo.alt || `${destination} trip`,
    credit: photo.credit,
  };
}
