import { NextRequest } from "next/server";
import { generateRequestSchema } from "@/lib/validation/itinerarySchema";
import { findCachedItinerary, saveItinerary } from "@/lib/db/queries/itinerary";
import { geocodeCity } from "@/lib/maps/geocode";
import { ensureDayImages, ensureHeroImage } from "@/lib/images/unsplashClient";
import llmClient, { getLlmModelLabel } from "@/lib/llm";
import type { ItineraryPayload, DayItinerary, VibeTag, PurposeTag } from "@/types/itinerary";
import slugify from "slugify";
import {
  enrichActivitiesWithCosts,
  estimateTripCost,
  injectDestinationActivities,
  normalizeActivityCategory,
  toPricingVariants,
} from "@/lib/costs/estimateTrip";
import { PUBLIC_ERRORS, safeErrorLog } from "@/lib/security/sanitize";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

function makeSlug(origin: string, destination: string, vibe: string): string {
  const base = `${origin}-${destination}-${vibe}`;
  return slugify(base, { lower: true, strict: true }) + "-" + Date.now().toString(36);
}

function serializeDay(day: DayItinerary): string {
  return JSON.stringify({ type: "day", data: day });
}

function serializeMeta(payload: ItineraryPayload): string {
  return JSON.stringify({ type: "meta", data: payload });
}

function serializeError(message: string): string {
  return JSON.stringify({ type: "error", data: { message } });
}

async function enrichItinerary(
  raw: ItineraryPayload,
  input: { origin: string; destination: string; duration: { days: number }; vibe: { primary: string; secondary?: string }; interests: string[]; purpose: string[] }
): Promise<ItineraryPayload> {
  // Normalize itinerary to always be an array (LLMs sometimes return objects)
  if (!Array.isArray(raw.itinerary)) {
    if (raw.itinerary && typeof raw.itinerary === "object") {
      raw.itinerary = Object.values(raw.itinerary) as DayItinerary[];
    } else {
      raw.itinerary = [];
    }
  }

  // Normalize each day's places_visited + activity categories
  for (const day of raw.itinerary) {
    if (!Array.isArray(day.places_visited)) {
      day.places_visited = [];
    }
    if (!Array.isArray(day.activities)) {
      day.activities = [];
    }
    day.activities = day.activities.map((a) => ({
      name: a.name,
      category: normalizeActivityCategory(a.category),
      // Strip any LLM-invented prices; catalog fills these later
      estimated_cost_inr: undefined,
    }));
  }

  const originGeo = await geocodeCity(input.origin);
  const destGeo = await geocodeCity(input.destination);

  const slug = makeSlug(input.origin, input.destination, input.vibe.primary);

  raw.id = raw.id || crypto.randomUUID();
  raw.slug = slug;
  raw.source = "ai_generated";
  raw.origin = input.origin;
  raw.destination = input.destination;
  raw.vibe = {
    primary: input.vibe.primary as VibeTag,
    secondary: input.vibe.secondary as VibeTag | undefined,
  };
  raw.purpose = input.purpose as PurposeTag[];
  raw.interests = input.interests;
  const daysFromModel =
    typeof raw.duration?.days === "number" && raw.duration.days >= 1
      ? Math.min(10, raw.duration.days)
      : input.duration.days;
  raw.duration = {
    days: daysFromModel,
    nights: Math.max(1, daysFromModel - 1),
  };
  raw.places = [input.origin, input.destination];

  raw.route_geo = {
    waypoints: [originGeo, destGeo],
  };

  if (!raw.title) {
    raw.title = `Vibe Check: ${input.destination} — ${input.vibe.primary}`;
  }

  if (!raw.route_summary) {
    raw.route_summary = `${input.duration.days}-day trip from ${input.origin} to ${input.destination} with a ${input.vibe.primary} vibe.`;
  }

  if (!raw.tags) {
    raw.tags = [input.destination.toLowerCase(), input.vibe.primary, ...input.interests.slice(0, 3)];
  }

  if (!raw.details) {
    raw.details = {
      overview: raw.route_summary,
      highlights: raw.itinerary.slice(0, 4).map((d) => d.title),
    };
  }

  if (!raw.inclusions) raw.inclusions = ["AI-generated itinerary"];
  if (!raw.exclusions) {
    raw.exclusions = [
      "Intercity travel to destination",
      "International flights",
      "Travel insurance",
      "Personal shopping",
    ];
  }

  // Inject real destination water/air/adventure activities when missing, then price from catalog
  raw.itinerary = injectDestinationActivities(raw.itinerary, input.destination);
  raw.itinerary = enrichActivitiesWithCosts(raw.itinerary, input.destination);

  for (const day of raw.itinerary) {
    const dayTotal = (day.activities || []).reduce(
      (sum, a) => sum + (a.estimated_cost_inr || 0),
      0
    );
    day.estimated_cost_inr = dayTotal;
  }

  const costEstimate = estimateTripCost(
    input.destination,
    raw.duration.days,
    raw.duration.nights,
    raw.itinerary
  );
  raw.trip_budget = {
    currency: "INR",
    per_person_low: costEstimate.per_person.low,
    per_person_high: costEstimate.per_person.high,
    breakdown: costEstimate.breakdown,
    note: costEstimate.note,
    source: costEstimate.source,
  };
  raw.pricing_variants = toPricingVariants(costEstimate);

  raw.ai_meta = {
    grounded: true,
    generated_at: new Date().toISOString(),
    model: getLlmModelLabel(),
    verification_note:
      "Activities & cost ranges use destination rate tables (budget–mid). Verify operators and live prices before booking.",
  };

  // Enrich hero + every day card with Unsplash photos
  raw.hero_image = await ensureHeroImage(input.destination, raw.hero_image);
  raw.itinerary = await ensureDayImages(raw.itinerary, input.destination);

  for (const day of raw.itinerary) {
    // Ensure days have proper geo
    if (day.places_visited.length === 0) {
      day.places_visited = [{ name: day.location, lat: destGeo.lat, lng: destGeo.lng }];
    }
  }

  return raw;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit({
    key: clientKey(req, "generate"),
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return new Response(serializeError(PUBLIC_ERRORS.rateLimited), {
      status: 429,
      headers: {
        "Content-Type": "text/event-stream",
        "Retry-After": String(limited.retryAfterSec),
        "Cache-Control": "no-store",
      },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(serializeError(PUBLIC_ERRORS.validation), {
      status: 400,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
    });
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(serializeError(PUBLIC_ERRORS.validation), {
      status: 400,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
    });
  }

  const input = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        // Skip cache when revising an existing trip
        if (!input.modification) {
          const cached = await findCachedItinerary(
            input.origin,
            input.destination,
            input.vibe.primary,
            input.interests
          );

          if (cached) {
            const refreshed = await enrichItinerary(cached, {
              origin: input.origin,
              destination: input.destination,
              duration: input.duration,
              vibe: input.vibe,
              interests: input.interests,
              purpose: input.purpose,
            });
            // Keep the original slug/id from cache so share links stay stable
            refreshed.id = cached.id;
            refreshed.slug = cached.slug;
            refreshed.source = cached.source;

            for (const day of refreshed.itinerary) {
              send(serializeDay(day));
            }
            send(serializeMeta(refreshed));
            controller.close();
            return;
          }
        }

        // Generate / modify from LLM
        const rawItinerary = await llmClient.generateItinerary(input);

        const itinerary = await enrichItinerary(rawItinerary, input);

        // Validate basic structure
        if (!itinerary.itinerary || !Array.isArray(itinerary.itinerary) || itinerary.itinerary.length === 0) {
          throw new Error("LLM returned empty or invalid itinerary");
        }

        // Check for duplicate descriptions (FR-6)
        const descs = itinerary.itinerary.map((d) => d.description.toLowerCase().trim());
        const uniqueDescs = new Set(descs);
        if (uniqueDescs.size < descs.length * 0.8) {
          console.warn("Warning: Some day descriptions are too similar");
        }

        // Stream each day
        for (const day of itinerary.itinerary) {
          send(serializeDay(day));
        }

        // Send final meta
        send(serializeMeta(itinerary));

        // Persist to DB (fire and forget)
        saveItinerary(itinerary).catch((err) => {
          safeErrorLog("saveItinerary", err);
        });

        controller.close();
      } catch (err) {
        safeErrorLog("generate", err);
        send(serializeError(PUBLIC_ERRORS.generate));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
