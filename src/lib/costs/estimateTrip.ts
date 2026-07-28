import type {
  Activity,
  ActivityCategory,
  DayItinerary,
  PricingVariants,
  TripBudget,
} from "@/types/itinerary";
import {
  CATEGORY_COST_INR,
  findCatalogMatch,
  getDestinationCosts,
  type CatalogActivity,
} from "./destinationCatalog";

export interface TripCostEstimate {
  currency: "INR";
  per_person: {
    low: number;
    high: number;
  };
  breakdown: {
    stay: [number, number];
    food: [number, number];
    local_transport: [number, number];
    activities: [number, number];
  };
  note: string;
  source: string;
}

const ROUND_TO = 100;

function roundMoney(n: number): number {
  return Math.max(0, Math.round(n / ROUND_TO) * ROUND_TO);
}

function activityCostRange(
  activity: Activity,
  destination: string
): [number, number] {
  if (
    typeof activity.estimated_cost_inr === "number" &&
    activity.estimated_cost_inr >= 0
  ) {
    const mid = activity.estimated_cost_inr;
    return [roundMoney(mid * 0.85), roundMoney(mid * 1.2)];
  }

  const match = findCatalogMatch(activity.name, destination);
  if (match) {
    return [
      roundMoney(match.estimated_cost_inr * 0.85),
      roundMoney(match.estimated_cost_inr * 1.2),
    ];
  }

  return CATEGORY_COST_INR[activity.category] ?? [300, 1000];
}

/** Attach catalog prices to activities (never trust LLM prices). */
export function enrichActivitiesWithCosts(
  days: DayItinerary[],
  destination: string
): DayItinerary[] {
  const catalog = getDestinationCosts(destination).activities;

  return days.map((day) => ({
    ...day,
    activities: (day.activities || []).map((activity) => {
      const match = findCatalogMatch(activity.name, destination);
      const estimated_cost_inr =
        match?.estimated_cost_inr ??
        Math.round(
          ((CATEGORY_COST_INR[activity.category]?.[0] ?? 300) +
            (CATEGORY_COST_INR[activity.category]?.[1] ?? 1000)) /
            2
        );
      return {
        ...activity,
        estimated_cost_inr,
      };
    }),
  }));
}

/**
 * Inject destination-typical water / air / adventure activities when the LLM
 * skipped them. Uses the local catalog only — no invented venues.
 */
export function injectDestinationActivities(
  days: DayItinerary[],
  destination: string
): DayItinerary[] {
  if (!days.length) return days;

  const catalog = getDestinationCosts(destination).activities;
  const featured = catalog.filter((a) =>
    ["water", "air", "adventure"].includes(a.category)
  );
  if (!featured.length) return days;

  const existing = new Set(
    days
      .flatMap((d) => d.activities || [])
      .map((a) => a.name.toLowerCase())
  );

  const hasWater = days.some((d) =>
    (d.activities || []).some((a) => a.category === "water")
  );
  const hasAir = days.some((d) =>
    (d.activities || []).some((a) => a.category === "air")
  );
  const hasAdventure = days.some((d) =>
    (d.activities || []).some((a) => a.category === "adventure")
  );

  const needed: CatalogActivity[] = [];
  if (!hasWater) {
    const w = featured.find((a) => a.category === "water");
    if (w && !existing.has(w.name.toLowerCase())) needed.push(w);
  }
  if (!hasAir) {
    const a = featured.find((a) => a.category === "air");
    if (a && !existing.has(a.name.toLowerCase())) needed.push(a);
  }
  if (!hasAdventure && needed.length < 2) {
    const adv = featured.find((a) => a.category === "adventure");
    if (adv && !existing.has(adv.name.toLowerCase())) needed.push(adv);
  }

  if (!needed.length) return days;

  const next = days.map((d) => ({
    ...d,
    activities: [...(d.activities || [])],
  }));

  needed.forEach((item, i) => {
    const day = next[i % next.length];
    day.activities.push({
      name: item.name,
      category: item.category,
      estimated_cost_inr: item.estimated_cost_inr,
    });
  });

  return next;
}

export function estimateTripCost(
  destination: string,
  days: number,
  nights: number,
  dayPlans: DayItinerary[]
): TripCostEstimate {
  const dest = getDestinationCosts(destination);
  const safeDays = Math.max(1, days);
  const safeNights = Math.max(1, nights);

  const stay: [number, number] = [
    dest.stay_per_night[0] * safeNights,
    dest.stay_per_night[1] * safeNights,
  ];
  const food: [number, number] = [
    dest.food_per_day[0] * safeDays,
    dest.food_per_day[1] * safeDays,
  ];
  const local_transport: [number, number] = [
    dest.transport_per_day[0] * safeDays,
    dest.transport_per_day[1] * safeDays,
  ];

  let actLow = 0;
  let actHigh = 0;
  const seen = new Set<string>();

  for (const day of dayPlans) {
    for (const activity of day.activities || []) {
      const key = activity.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const [lo, hi] = activityCostRange(activity, destination);
      actLow += lo;
      actHigh += hi;
    }
  }

  // If almost no paid activities, include a couple catalog samples so the
  // estimate still reflects destination-typical paid experiences.
  if (actHigh < 500) {
    for (const sample of dest.activities.slice(0, 2)) {
      actLow += Math.round(sample.estimated_cost_inr * 0.85);
      actHigh += Math.round(sample.estimated_cost_inr * 1.2);
    }
  }

  const activities: [number, number] = [actLow, actHigh];
  const low = roundMoney(stay[0] + food[0] + local_transport[0] + activities[0]);
  const high = roundMoney(
    stay[1] + food[1] + local_transport[1] + activities[1]
  );

  return {
    currency: "INR",
    per_person: { low, high },
    breakdown: {
      stay: [roundMoney(stay[0]), roundMoney(stay[1])],
      food: [roundMoney(food[0]), roundMoney(food[1])],
      local_transport: [
        roundMoney(local_transport[0]),
        roundMoney(local_transport[1]),
      ],
      activities: [roundMoney(activities[0]), roundMoney(activities[1])],
    },
    note: `Estimated for 1 person · ${safeDays} days / ${safeNights} nights · stay, food, local transport & listed activities. Intercity travel to ${destination} not included.`,
    source:
      "Based on typical published local rates (budget–mid) for this destination — not a live booking quote.",
  };
}

export function toPricingVariants(estimate: TripCostEstimate): PricingVariants {
  const mid = Math.round(
    (estimate.per_person.low + estimate.per_person.high) / 2
  );
  return {
    solo_traveler: mid,
    duo: mid * 2,
    couple: mid * 2,
    trio: Math.round(mid * 2.7),
    quad: mid * 3.5,
    friends: mid * 3,
    note: `${formatInrRange(estimate.per_person.low, estimate.per_person.high)} per person. ${estimate.source}`,
  };
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatInrRange(low: number, high: number): string {
  return `${formatInr(low)} – ${formatInr(high)}`;
}

/** Always return a budget — use server value when present, else compute locally. */
export function resolveTripBudget(
  meta: {
    destination: string;
    duration: { days: number; nights: number };
    trip_budget?: TripBudget;
    itinerary?: DayItinerary[];
  },
  days: DayItinerary[] = []
): TripBudget {
  if (
    meta.trip_budget &&
    typeof meta.trip_budget.per_person_low === "number" &&
    typeof meta.trip_budget.per_person_high === "number"
  ) {
    return meta.trip_budget;
  }

  const dayPlans = days.length ? days : meta.itinerary || [];
  const estimate = estimateTripCost(
    meta.destination,
    meta.duration.days,
    meta.duration.nights,
    dayPlans
  );

  return {
    currency: "INR",
    per_person_low: estimate.per_person.low,
    per_person_high: estimate.per_person.high,
    breakdown: estimate.breakdown,
    note: estimate.note,
    source: estimate.source,
  };
}

const CATEGORY_ALIASES: Record<string, ActivityCategory> = {
  food: "food",
  cafe: "food",
  café: "food",
  restaurant: "food",
  sightseeing: "sightseeing",
  sight: "sightseeing",
  nightlife: "nightlife",
  club: "nightlife",
  nature: "nature",
  trek: "adventure",
  trekking: "adventure",
  adventure: "adventure",
  culture: "culture",
  heritage: "culture",
  music: "music",
  shopping: "shopping",
  market: "shopping",
  water: "water",
  watersports: "water",
  "water-sports": "water",
  rafting: "water",
  scuba: "water",
  kayak: "water",
  boat: "water",
  air: "air",
  paragliding: "air",
  parasailing: "air",
  balloon: "air",
  bungee: "air",
  wellness: "wellness",
  spa: "wellness",
  yoga: "wellness",
  transport: "transport",
};

export function normalizeActivityCategory(
  raw: string | undefined
): ActivityCategory {
  if (!raw) return "sightseeing";
  const key = raw.toLowerCase().trim();
  if (key in CATEGORY_ALIASES) return CATEGORY_ALIASES[key];
  for (const [alias, cat] of Object.entries(CATEGORY_ALIASES)) {
    if (key.includes(alias)) return cat;
  }
  return "sightseeing";
}
