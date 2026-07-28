export const VIBE_TAGS = [
  "monsoon-chill",
  "indie-music",
  "street-food",
  "heritage-walk",
  "nightlife",
  "nature-escape",
  "photography",
  "budget-backpacking",
  "family-mellow",
  "solo-reset",
] as const;

export type VibeTag = (typeof VIBE_TAGS)[number];

export const PURPOSE_TAGS = [
  "leisure",
  "bachelor-trip",
  "bachelorette-trip",
  "solo-reflection",
  "college-trip",
  "anniversary",
  "work-cation",
  "festival-specific",
] as const;

export type PurposeTag = (typeof PURPOSE_TAGS)[number];

export const INTEREST_OPTIONS = [
  "street food",
  "indie music",
  "architecture walks",
  "thrift/markets",
  "nature",
  "adventure sports",
  "water sports",
  "paragliding / air sports",
  "trekking",
  "photography",
  "nightlife",
  "café hopping",
  "local art",
  "heritage",
  "backpacking",
] as const;

export type Interest = (typeof INTEREST_OPTIONS)[number];

export const ACTIVITY_CATEGORIES = [
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
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  food: "Food",
  sightseeing: "Sightseeing",
  nightlife: "Nightlife",
  nature: "Nature",
  adventure: "Adventure",
  culture: "Culture",
  music: "Music",
  shopping: "Shopping",
  water: "Water",
  air: "Air",
  wellness: "Wellness",
  transport: "Transport",
};

export interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface ImageAsset {
  url: string;
  alt: string;
  credit?: string;
}

export interface Activity {
  name: string;
  category: ActivityCategory;
  /** Typical local price in INR — filled by cost catalog, not the LLM */
  estimated_cost_inr?: number;
}

export interface DayItinerary {
  day: number;
  title: string;
  location: string;
  description: string;
  activities: Activity[];
  places_visited: GeoPoint[];
  meals?: string;
  image?: ImageAsset;
  /** Day subtotal from catalog rates (INR, per person) */
  estimated_cost_inr?: number;
}

export interface PricingVariants {
  solo_traveler?: number;
  couple?: number;
  duo?: number;
  trio?: number;
  quad?: number;
  family?: number;
  friends?: number;
  note?: string;
}

export interface TripBudget {
  currency: "INR";
  per_person_low: number;
  per_person_high: number;
  breakdown?: {
    stay: [number, number];
    food: [number, number];
    local_transport: [number, number];
    activities: [number, number];
  };
  note: string;
  source: string;
}

export interface AiMeta {
  grounded: boolean;
  generated_at: string;
  model: string;
  verification_note?: string;
}

export interface ItineraryPayload {
  id: string;
  slug: string;
  source: "curated" | "ai_generated";
  title: string;
  origin: string;
  destination: string;
  vibe: {
    primary: VibeTag;
    secondary?: VibeTag;
  };
  purpose: PurposeTag[];
  interests: string[];
  duration: { nights: number; days: number };
  route_summary: string;
  places: string[];
  route_geo: {
    waypoints: GeoPoint[];
  };
  hero_image?: ImageAsset;
  gallery?: ImageAsset[];
  pricing_variants?: PricingVariants;
  /** Grounded budget from destination rate tables — never LLM-invented */
  trip_budget?: TripBudget;
  tags: string[];
  details: {
    overview: string;
    highlights: string[];
    accommodation?: string;
    meals?: string;
    transportation?: string;
  };
  itinerary: DayItinerary[];
  inclusions: string[];
  exclusions: string[];
  ai_meta: AiMeta;
}

export interface GenerateRequest {
  origin: string;
  destination: string;
  vibe: { primary: VibeTag; secondary?: VibeTag };
  interests: Interest[];
  purpose: PurposeTag[];
  duration: { days: number };
  extra_context?: string;
}

export interface PopularRoute {
  slug: string;
  title: string;
  origin: string;
  destination: string;
  vibe_primary: string;
  hero_image?: ImageAsset;
  hit_count: number;
}
