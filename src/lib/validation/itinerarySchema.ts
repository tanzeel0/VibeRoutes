import { z } from "zod";

export const geoPointSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export const imageAssetSchema = z.object({
  url: z.string().url(),
  alt: z.string(),
  credit: z.string().optional(),
});

export const activitySchema = z.object({
  name: z.string(),
  category: z.enum([
    "food",
    "sightseeing",
    "nightlife",
    "nature",
    "adventure",
    "culture",
    "music",
    "shopping",
    "water",
    "air",
    "wellness",
    "transport",
  ]),
  estimated_cost_inr: z.number().optional(),
});

export const dayItinerarySchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  description: z.string().min(20),
  activities: z.array(activitySchema).min(1),
  places_visited: z.array(geoPointSchema).min(1),
  meals: z.string().optional(),
  image: imageAssetSchema.optional(),
});

export const pricingVariantsSchema = z.object({
  solo_traveler: z.number().optional(),
  couple: z.number().optional(),
  duo: z.number().optional(),
  trio: z.number().optional(),
  quad: z.number().optional(),
  family: z.number().optional(),
  friends: z.number().optional(),
  note: z.string().optional(),
});

export const aiMetaSchema = z.object({
  grounded: z.boolean(),
  generated_at: z.string(),
  model: z.string(),
  verification_note: z.string().optional(),
});

export const itineraryPayloadSchema = z.object({
  id: z.string(),
  slug: z.string(),
  source: z.enum(["curated", "ai_generated"]),
  title: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  vibe: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
  }),
  purpose: z.array(z.string()).min(1),
  interests: z.array(z.string()).min(1),
  duration: z.object({
    nights: z.number().int().min(1),
    days: z.number().int().min(1),
  }),
  route_summary: z.string().min(10),
  places: z.array(z.string()).min(2),
  route_geo: z.object({
    waypoints: z.array(geoPointSchema).min(2),
  }),
  hero_image: imageAssetSchema.optional(),
  gallery: z.array(imageAssetSchema).optional(),
  pricing_variants: pricingVariantsSchema.optional(),
  tags: z.array(z.string()),
  details: z.object({
    overview: z.string().min(10),
    highlights: z.array(z.string()).min(1),
    accommodation: z.string().optional(),
    meals: z.string().optional(),
    transportation: z.string().optional(),
  }),
  itinerary: z.array(dayItinerarySchema).min(1),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  ai_meta: aiMetaSchema,
});

export const generateRequestSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  vibe: z.object({
    primary: z.string().min(1),
    secondary: z.string().optional(),
  }),
  interests: z.array(z.string()).min(1),
  purpose: z.array(z.string()).min(1),
  duration: z.object({
    days: z.number().int().min(1).max(10),
  }),
  extra_context: z.string().optional(),
  /** When set, revise the existing trip instead of creating a brand-new one */
  modification: z.string().min(1).optional(),
  existing_itinerary: z
    .object({
      title: z.string().optional(),
      route_summary: z.string().optional(),
      duration: z
        .object({
          days: z.number().optional(),
          nights: z.number().optional(),
        })
        .optional(),
      itinerary: z.array(z.unknown()).optional(),
    })
    .optional(),
});

export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;
