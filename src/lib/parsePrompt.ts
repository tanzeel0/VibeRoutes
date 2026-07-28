import type { GenerateRequest, VibeTag, Interest, PurposeTag } from "@/types/itinerary";

const INDIAN_CITIES = [
  "Delhi", "Mumbai", "Bangalore", "Manali", "Darjeeling", "Goa", "Jaipur",
  "Varanasi", "Kolkata", "Chennai", "Hyderabad", "Pune", "Shimla", "Rishikesh",
  "Pondicherry", "Udaipur", "Jodhpur", "Amritsar", "Leh", "Spiti", "McLeodganj",
  "Kasol", "Hampi", "Munnar", "Alleppey", "Coorg", "Ooty", "Mahabaleshwar",
  "Lonavala", "Nainital", "Dharamshala", "Mussoorie", "Jim Corbett",
];

const VIBE_KEYWORDS: Record<string, VibeTag> = {
  "monsoon": "monsoon-chill",
  "chill": "monsoon-chill",
  "music": "indie-music",
  "indie": "indie-music",
  "food": "street-food",
  "street food": "street-food",
  "heritage": "heritage-walk",
  "history": "heritage-walk",
  "nightlife": "nightlife",
  "party": "nightlife",
  "nature": "nature-escape",
  "mountain": "nature-escape",
  "photo": "photography",
  "backpack": "budget-backpacking",
  "budget": "budget-backpacking",
  "family": "family-mellow",
  "solo": "solo-reset",
  "adventure": "nature-escape",
};

const INTEREST_KEYWORDS: Record<string, Interest> = {
  "food": "street food",
  "street food": "street food",
  "music": "indie music",
  "indie": "indie music",
  "architecture": "architecture walks",
  "heritage": "heritage",
  "thrift": "thrift/markets",
  "market": "thrift/markets",
  "nature": "nature",
  "adventure": "adventure sports",
  "water": "water sports",
  "scuba": "water sports",
  "rafting": "water sports",
  "kayak": "water sports",
  "paragliding": "paragliding / air sports",
  "parasailing": "paragliding / air sports",
  "trek": "trekking",
  "trekking": "trekking",
  "photo": "photography",
  "nightlife": "nightlife",
  "cafe": "café hopping",
  "café": "café hopping",
  "art": "local art",
  "backpack": "backpacking",
};

function matchCity(name: string): string {
  const found = INDIAN_CITIES.find((c) => c.toLowerCase() === name.toLowerCase().trim());
  return found || name.trim();
}

export function parseNaturalLanguage(text: string): GenerateRequest {
  const lower = text.toLowerCase();

  // Try "from X to Y" pattern first
  const fromToMatch = text.match(/from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?:\s*,|\s+for|\s+\d|\s*$)/i);

  // Find all known cities mentioned
  const foundCities = INDIAN_CITIES.filter((c) => lower.includes(c.toLowerCase()));

  let origin = "Delhi";
  let destination = "Manali";

  if (fromToMatch) {
    origin = matchCity(fromToMatch[1]);
    destination = matchCity(fromToMatch[2]);
  } else if (foundCities.length >= 2) {
    origin = foundCities[0];
    destination = foundCities[1];
  } else if (foundCities.length === 1) {
    destination = foundCities[0];
  }

  // Parse duration
  let days = 4;
  const dayMatch = text.match(/(\d+)\s*day/i);
  if (dayMatch) {
    days = Math.min(10, Math.max(1, parseInt(dayMatch[1])));
  }
  if (/week\s*end/i.test(text)) days = 2;

  // Parse vibe
  let vibe: VibeTag = "street-food";
  // Check multi-word keywords first
  for (const [keyword, tag] of Object.entries(VIBE_KEYWORDS)) {
    if (keyword.includes(" ") && lower.includes(keyword)) {
      vibe = tag;
      break;
    }
  }
  // Then single-word
  if (vibe === "street-food") {
    for (const [keyword, tag] of Object.entries(VIBE_KEYWORDS)) {
      if (!keyword.includes(" ") && lower.includes(keyword)) {
        vibe = tag;
        break;
      }
    }
  }

  // Parse interests
  const interests: Interest[] = ["street food"];
  for (const [keyword, interest] of Object.entries(INTEREST_KEYWORDS)) {
    if (lower.includes(keyword) && !interests.includes(interest)) {
      interests.push(interest);
    }
  }

  // Parse purpose
  const purpose: PurposeTag[] = ["leisure"];
  if (/solo/i.test(text)) purpose[0] = "solo-reflection";
  if (/family/i.test(text)) purpose[0] = "leisure";
  if (/bachelor/i.test(text)) purpose[0] = "bachelor-trip";
  if (/college/i.test(text)) purpose[0] = "college-trip";
  if (/anniversary/i.test(text)) purpose[0] = "anniversary";

  return {
    origin,
    destination,
    vibe: { primary: vibe },
    interests,
    purpose,
    duration: { days },
    extra_context: text,
  };
}
