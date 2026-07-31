import { z } from "zod";
import { VIBE_TAGS, INTEREST_OPTIONS, PURPOSE_TAGS } from "@/types/itinerary";

export const vibeEnum = z.enum(VIBE_TAGS);
export const purposeEnum = z.enum(PURPOSE_TAGS);

export const tripSlotsSchema = z.object({
  origin: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  days: z.number().int().min(1).max(10).optional().nullable(),
  vibe: vibeEnum.optional().nullable(),
  interests: z.array(z.string()).optional().nullable(),
  purpose: z.array(z.string()).optional().nullable(),
  extra_context: z.string().optional().nullable(),
});

export type TripSlots = z.infer<typeof tripSlotsSchema>;

export const intentSchema = z.object({
  intent: z.enum([
    "trip_details", // user providing trip prefs / answering a question
    "travel_question", // in-domain travel Q&A
    "off_topic", // anything outside travel planning
    "ready", // user wants to generate now
  ]),
  reason: z.string(),
  is_travel_related: z.boolean(),
});

export type IntentResult = z.infer<typeof intentSchema>;

export const wizardTurnSchema = z.object({
  reply: z.string().min(1),
  suggestions: z.array(z.string()).max(8).nullable(),
  slots_patch: tripSlotsSchema.optional().nullable(),
  done: z.boolean(),
});

export type WizardTurn = z.infer<typeof wizardTurnSchema>;

export const generateRequestOutSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  vibe: z.object({
    primary: vibeEnum,
    secondary: vibeEnum.optional(),
  }),
  interests: z.array(z.string()).min(1),
  purpose: z.array(z.string()).min(1),
  duration: z.object({
    days: z.number().int().min(1).max(10),
  }),
  extra_context: z.string().optional(),
});

export const llmDaySchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  description: z.string().min(20),
  activities: z
    .array(
      z.object({
        name: z.string().min(1),
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
      })
    )
    .min(1),
  places_visited: z
    .array(
      z.object({
        name: z.string(),
        lat: z.number(),
        lng: z.number(),
      })
    )
    .min(1),
  meals: z.string().optional(),
});

export const llmItinerarySchema = z.object({
  title: z.string().min(1),
  route_summary: z.string().min(10),
  itinerary: z.array(llmDaySchema).min(1),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type LlmItinerary = z.infer<typeof llmItinerarySchema>;

export const INTEREST_HINTS = INTEREST_OPTIONS.join(", ");
export const VIBE_HINTS = VIBE_TAGS.join(", ");
export const PURPOSE_HINTS = PURPOSE_TAGS.join(", ");

export function missingSlotKeys(slots: TripSlots): string[] {
  const missing: string[] = [];
  if (!slots.origin?.trim()) missing.push("origin");
  if (!slots.destination?.trim()) missing.push("destination");
  if (!slots.days || slots.days < 1) missing.push("duration");
  if (!slots.vibe) missing.push("vibe");
  if (!slots.interests?.length) missing.push("interests");
  if (!slots.purpose?.length) missing.push("purpose");
  return missing;
}

export function slotsToRequest(slots: TripSlots) {
  const days = slots.days && slots.days >= 1 ? Math.min(10, slots.days) : 4;
  return {
    origin: (slots.origin || "").trim(),
    destination: (slots.destination || "").trim(),
    vibe: { primary: slots.vibe || ("street-food" as const) },
    interests:
      slots.interests && slots.interests.length > 0
        ? slots.interests
        : ["street food"],
    purpose:
      slots.purpose && slots.purpose.length > 0 ? slots.purpose : ["leisure"],
    duration: { days },
    extra_context: slots.extra_context?.trim() || undefined,
  };
}

export function mergeSlots(
  current: TripSlots,
  patch: TripSlots | null | undefined
): TripSlots {
  if (!patch) return current;
  return {
    origin: patch.origin?.trim() || current.origin,
    destination: patch.destination?.trim() || current.destination,
    days: patch.days ?? current.days,
    vibe: patch.vibe ?? current.vibe,
    interests:
      patch.interests && patch.interests.length > 0
        ? patch.interests
        : current.interests,
    purpose:
      patch.purpose && patch.purpose.length > 0
        ? patch.purpose
        : current.purpose,
    extra_context: patch.extra_context?.trim() || current.extra_context,
  };
}
