import type { ActivityCategory } from "@/types/itinerary";

export interface CatalogActivity {
  name: string;
  category: ActivityCategory;
  /** Typical operator price in INR (per person). Sourced from common published local rates. */
  estimated_cost_inr: number;
}

export interface DestinationCosts {
  /** Daily food per person [low, high] INR */
  food_per_day: [number, number];
  /** Stay per night per person [low, high] INR (budget–mid) */
  stay_per_night: [number, number];
  /** Local transport per day [low, high] INR */
  transport_per_day: [number, number];
  activities: CatalogActivity[];
}

/** Typical India destination rates (budget–mid, INR). Not live booking quotes. */
const CATALOG: Record<string, DestinationCosts> = {
  goa: {
    food_per_day: [700, 1600],
    stay_per_night: [1200, 3500],
    transport_per_day: [400, 900],
    activities: [
      { name: "Parasailing at Calangute / Baga", category: "air", estimated_cost_inr: 1500 },
      { name: "Banana boat / bumper ride", category: "water", estimated_cost_inr: 500 },
      { name: "Jet ski (per ride)", category: "water", estimated_cost_inr: 800 },
      { name: "Scuba diving (Grande Island)", category: "water", estimated_cost_inr: 4500 },
      { name: "Kayaking in Mandrem / Chapora", category: "water", estimated_cost_inr: 800 },
      { name: "Dudhsagar waterfall day trip", category: "nature", estimated_cost_inr: 2500 },
    ],
  },
  manali: {
    food_per_day: [600, 1400],
    stay_per_night: [1000, 3000],
    transport_per_day: [500, 1200],
    activities: [
      { name: "Paragliding in Solang / Marhi", category: "air", estimated_cost_inr: 2500 },
      { name: "River rafting on Beas", category: "water", estimated_cost_inr: 800 },
      { name: "Zorbing in Solang Valley", category: "adventure", estimated_cost_inr: 600 },
      { name: "ATV / quad bike Solang", category: "adventure", estimated_cost_inr: 1000 },
      { name: "Hadimba / Old Manali heritage walk", category: "culture", estimated_cost_inr: 0 },
      { name: "Snow activities (seasonal)", category: "adventure", estimated_cost_inr: 1500 },
    ],
  },
  rishikesh: {
    food_per_day: [500, 1200],
    stay_per_night: [800, 2500],
    transport_per_day: [300, 700],
    activities: [
      { name: "White-water rafting (Ganga)", category: "water", estimated_cost_inr: 1200 },
      { name: "Bungee jumping (Jumpin Heights)", category: "air", estimated_cost_inr: 4000 },
      { name: "Flying fox / giant swing", category: "air", estimated_cost_inr: 3500 },
      { name: "Cliff jumping (Shivpuri)", category: "adventure", estimated_cost_inr: 500 },
      { name: "Camping by the river", category: "nature", estimated_cost_inr: 1500 },
    ],
  },
  shimla: {
    food_per_day: [600, 1400],
    stay_per_night: [1200, 3200],
    transport_per_day: [400, 900],
    activities: [
      { name: "Toy train / Kalka–Shimla stretch", category: "sightseeing", estimated_cost_inr: 700 },
      { name: "Jakhu / Ridge heritage walk", category: "culture", estimated_cost_inr: 0 },
      { name: "Kufri day outing", category: "nature", estimated_cost_inr: 1200 },
      { name: "Ice skating (seasonal)", category: "adventure", estimated_cost_inr: 400 },
    ],
  },
  jaipur: {
    food_per_day: [600, 1500],
    stay_per_night: [1000, 3500],
    transport_per_day: [500, 1000],
    activities: [
      { name: "Amber Fort + elephant / jeep area visit", category: "sightseeing", estimated_cost_inr: 800 },
      { name: "Hot-air balloon (seasonal)", category: "air", estimated_cost_inr: 12000 },
      { name: "City Palace & bazaar walk", category: "culture", estimated_cost_inr: 500 },
      { name: "Chokhi Dhani cultural evening", category: "culture", estimated_cost_inr: 900 },
      { name: "Cooking class / food walk", category: "food", estimated_cost_inr: 1500 },
    ],
  },
  mumbai: {
    food_per_day: [800, 2000],
    stay_per_night: [1800, 5000],
    transport_per_day: [300, 800],
    activities: [
      { name: "Ferry to Elephanta Caves", category: "water", estimated_cost_inr: 400 },
      { name: "Gateway / Colaba heritage walk", category: "culture", estimated_cost_inr: 0 },
      { name: "Street-food crawl (Girgaon / Mohammed Ali Rd)", category: "food", estimated_cost_inr: 600 },
      { name: "Bandra art & café hop", category: "sightseeing", estimated_cost_inr: 800 },
      { name: "Nightlife at Lower Parel / Bandra", category: "nightlife", estimated_cost_inr: 2000 },
    ],
  },
  delhi: {
    food_per_day: [700, 1800],
    stay_per_night: [1500, 4500],
    transport_per_day: [300, 800],
    activities: [
      { name: "Old Delhi food walk", category: "food", estimated_cost_inr: 800 },
      { name: "Humayun’s Tomb & Lodhi art walk", category: "culture", estimated_cost_inr: 500 },
      { name: "Hauz Khas / Mehrauli café trail", category: "sightseeing", estimated_cost_inr: 700 },
      { name: "Yamuna / Okhla bird sanctuary", category: "nature", estimated_cost_inr: 100 },
    ],
  },
  udaipur: {
    food_per_day: [600, 1500],
    stay_per_night: [1200, 4000],
    transport_per_day: [400, 900],
    activities: [
      { name: "Lake Pichola boat ride", category: "water", estimated_cost_inr: 500 },
      { name: "City Palace visit", category: "culture", estimated_cost_inr: 300 },
      { name: "Monsoon Palace sunset", category: "sightseeing", estimated_cost_inr: 400 },
      { name: "Vintage car museum / old city walk", category: "culture", estimated_cost_inr: 350 },
    ],
  },
  leh: {
    food_per_day: [700, 1600],
    stay_per_night: [1200, 3500],
    transport_per_day: [800, 2000],
    activities: [
      { name: "Pangong Lake day trip", category: "nature", estimated_cost_inr: 3000 },
      { name: "Mountain biking / Khardung La", category: "adventure", estimated_cost_inr: 2500 },
      { name: "River rafting (Zanskar / Indus)", category: "water", estimated_cost_inr: 1500 },
      { name: "Monastery circuit (Thiksey / Hemis)", category: "culture", estimated_cost_inr: 400 },
    ],
  },
  kasol: {
    food_per_day: [500, 1200],
    stay_per_night: [700, 2000],
    transport_per_day: [400, 900],
    activities: [
      { name: "Kheerganga trek", category: "adventure", estimated_cost_inr: 800 },
      { name: "Parvati river trail / chill spots", category: "nature", estimated_cost_inr: 0 },
      { name: "Café hop (Kasol market)", category: "food", estimated_cost_inr: 600 },
      { name: "Manikaran day visit", category: "sightseeing", estimated_cost_inr: 400 },
    ],
  },
  hampi: {
    food_per_day: [500, 1200],
    stay_per_night: [800, 2200],
    transport_per_day: [400, 800],
    activities: [
      { name: "Coracle ride on Tungabhadra", category: "water", estimated_cost_inr: 500 },
      { name: "Boulder climbing / rock scramble", category: "adventure", estimated_cost_inr: 1000 },
      { name: "Virupaksha & ruins circuit", category: "culture", estimated_cost_inr: 400 },
      { name: "Sunset at Matanga Hill", category: "sightseeing", estimated_cost_inr: 0 },
    ],
  },
  munnar: {
    food_per_day: [600, 1400],
    stay_per_night: [1200, 3200],
    transport_per_day: [500, 1100],
    activities: [
      { name: "Tea plantation walk", category: "nature", estimated_cost_inr: 300 },
      { name: "Eravikulam / National Park", category: "nature", estimated_cost_inr: 500 },
      { name: "Boating at Kundala / Mattupetty", category: "water", estimated_cost_inr: 400 },
      { name: "Spice garden visit", category: "sightseeing", estimated_cost_inr: 250 },
    ],
  },
  coorg: {
    food_per_day: [600, 1400],
    stay_per_night: [1200, 3500],
    transport_per_day: [500, 1100],
    activities: [
      { name: "River rafting / tubing (Barapole)", category: "water", estimated_cost_inr: 1200 },
      { name: "Estate / coffee plantation walk", category: "nature", estimated_cost_inr: 400 },
      { name: "Trek to Tadiandamol / waterfalls", category: "adventure", estimated_cost_inr: 800 },
      { name: "Abbey / Raja’s Seat viewpoints", category: "sightseeing", estimated_cost_inr: 100 },
    ],
  },
  ooty: {
    food_per_day: [600, 1400],
    stay_per_night: [1200, 3200],
    transport_per_day: [400, 1000],
    activities: [
      { name: "Ooty lake boating", category: "water", estimated_cost_inr: 300 },
      { name: "Nilgiri mountain railway", category: "sightseeing", estimated_cost_inr: 500 },
      { name: "Botanical garden visit", category: "nature", estimated_cost_inr: 50 },
      { name: "Coonoor day trip", category: "sightseeing", estimated_cost_inr: 800 },
    ],
  },
  varanasi: {
    food_per_day: [500, 1300],
    stay_per_night: [900, 2800],
    transport_per_day: [300, 700],
    activities: [
      { name: "Ganga sunrise boat ride", category: "water", estimated_cost_inr: 500 },
      { name: "Ghats & lane food walk", category: "food", estimated_cost_inr: 500 },
      { name: "Sarnath day visit", category: "culture", estimated_cost_inr: 400 },
      { name: "Evening aarti viewing", category: "culture", estimated_cost_inr: 0 },
    ],
  },
  darjeeling: {
    food_per_day: [600, 1400],
    stay_per_night: [1000, 3000],
    transport_per_day: [400, 1000],
    activities: [
      { name: "Tiger Hill sunrise", category: "nature", estimated_cost_inr: 400 },
      { name: "Toy train joy ride", category: "sightseeing", estimated_cost_inr: 700 },
      { name: "Tea garden walk", category: "nature", estimated_cost_inr: 300 },
      { name: "Ropeway / cable car", category: "air", estimated_cost_inr: 300 },
    ],
  },
};

const DEFAULT_COSTS: DestinationCosts = {
  food_per_day: [600, 1500],
  stay_per_night: [1000, 3000],
  transport_per_day: [400, 900],
  activities: [
    { name: "Local sightseeing circuit", category: "sightseeing", estimated_cost_inr: 500 },
    { name: "Street-food crawl", category: "food", estimated_cost_inr: 500 },
    { name: "Nature / viewpoint outing", category: "nature", estimated_cost_inr: 400 },
  ],
};

/** Category averages used when an activity isn't in the destination catalog. */
export const CATEGORY_COST_INR: Record<ActivityCategory, [number, number]> = {
  food: [300, 800],
  sightseeing: [200, 800],
  nightlife: [800, 2500],
  nature: [0, 600],
  adventure: [800, 3000],
  culture: [100, 700],
  music: [500, 2000],
  shopping: [500, 2500],
  water: [500, 4500],
  air: [1500, 12000],
  wellness: [800, 3000],
  transport: [200, 1500],
};

export function normalizeCityKey(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)[0];
}

export function getDestinationCosts(destination: string): DestinationCosts {
  const key = normalizeCityKey(destination);
  return CATALOG[key] ?? DEFAULT_COSTS;
}

export function findCatalogMatch(
  activityName: string,
  destination: string
): CatalogActivity | undefined {
  const costs = getDestinationCosts(destination);
  const lower = activityName.toLowerCase();
  return costs.activities.find((a) => {
    const tokens = a.name.toLowerCase().split(/[\s/,]+/).filter((t) => t.length > 3);
    return tokens.some((t) => lower.includes(t)) || lower.includes(a.category);
  });
}
