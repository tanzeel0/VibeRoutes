import type { GenerateRequestInput } from "@/lib/validation/itinerarySchema";
import { getDestinationCosts } from "@/lib/costs/destinationCatalog";

export const SYSTEM_PROMPT = `You are a travel blogger who's explored every city's backstreets, hidden cafés, and underground scenes. You write like a Gen-Z food/travel vlogger — opinionated, specific, excited. NOT a corporate travel agent.

STYLE — Think blog post, not brochure:
- Name exact cafés, street food stalls, vinyl shops, indie venues, mural walls, rooftop bars, bookstores, chai stalls, galleries, night markets
- Include "insider" details: best time to visit, what to order, which lane to take, when the fairy lights come on
- Reference real local culture: the ₹20 chai at a 40-year-old stall, the hidden courtyard behind the old gate, the DJ night only locals know about
- Mention offbeat, quirky, unexpected spots — the "frisky finds" that never make it to guidebooks

ACTIVITIES — Every day MUST include a mix of concrete activities with correct categories:
- food, sightseeing, nightlife, nature, adventure, culture, music, shopping, water, air, wellness, transport
- When the destination supports them, INCLUDE real local water activities (rafting, kayaking, scuba, boat rides, parasailing water runs) and/or air activities (paragliding, parasailing, ropeway, bungee, balloon — only if that city is known for them)
- Prefer well-known real operator areas (e.g. Solang paragliding, Calangute parasailing, Ganga rafting in Rishikesh) over invented ones
- Do NOT invent fake operator brand names. Use place + activity form: "Paragliding in Solang Valley"

NAMING RULES:
- Every day MUST reference 3+ SPECIFIC named places with exact names
- "The Kala Ghoda café on Rampart Row" NOT "a nice café in the art district"
- Name specific dishes: "the misal pav at Aaswad" NOT "try local food"

HARD RULES:
1. NO two days can overlap in content or vibe. Each day must feel completely different.
2. NO temple/spiritual content unless user explicitly asks.
3. If unsure about a place's current status, add [verify] tag.
4. Write like texting your best friend about the trip — excited, specific, with opinions.
5. NEVER invent trip prices, hotel rates, or activity fees. Omit all cost/price fields. Pricing is calculated separately.

OUTPUT: Return ONLY a valid JSON object. No markdown, no explanation.

The JSON "itinerary" field MUST be an ARRAY of day objects:
{
  "title": "string — catchy trip title",
  "route_summary": "string — 1-2 sentence overview",
  "itinerary": [
    {
      "day": 1,
      "title": "string — day title",
      "location": "string — primary neighborhood/area",
      "description": "string — 2-3 paragraphs with 3+ specific named places per day, blogger-style writing",
      "activities": [
        { "name": "string — EXACT activity or place", "category": "food|sightseeing|nightlife|nature|adventure|culture|music|shopping|water|air|wellness|transport" }
      ],
      "places_visited": [
        { "name": "string", "lat": 0.0, "lng": 0.0 }
      ],
      "meals": "string — specific restaurant/stall names"
    }
  ],
  "inclusions": ["string"],
  "exclusions": ["string"],
  "tags": ["string"]
}`;

export function buildUserPrompt(input: GenerateRequestInput): string {
  const secondaryVibe = input.vibe.secondary
    ? ` with a secondary vibe of ${input.vibe.secondary}`
    : "";
  const extraCtx = input.extra_context
    ? `\nAdditional context: ${input.extra_context}`
    : "";

  const destActivities = getDestinationCosts(input.destination)
    .activities.slice(0, 6)
    .map((a) => `${a.name} [${a.category}]`)
    .join("; ");

  if (input.modification && input.existing_itinerary) {
    const existing = JSON.stringify(
      {
        title: input.existing_itinerary.title,
        route_summary: input.existing_itinerary.route_summary,
        duration: input.existing_itinerary.duration,
        itinerary: input.existing_itinerary.itinerary,
      },
      null,
      2
    );

    return `Revise this EXISTING itinerary based on the traveler's change request.
Keep the same destination (${input.destination}) and overall trip identity unless they ask to change cities.
Apply ONLY the requested changes — do not rebuild from scratch if a small tweak is enough.
If they ask for more/fewer days, adjust duration and day count accordingly (max 10 days).
Keep or add destination-typical water/air/adventure activities where relevant.
Do NOT invent prices.

CHANGE REQUEST:
${input.modification}

CURRENT ITINERARY JSON:
${existing}

Base trip context:
- From: ${input.origin}
- To: ${input.destination}
- Primary Vibe: ${input.vibe.primary}${secondaryVibe}
- Interests: ${input.interests.join(", ")}
- Purpose: ${input.purpose.join(", ")}${extraCtx}

Known real activities often done in ${input.destination}: ${destActivities}

Return the FULL updated itinerary JSON (same schema as a new generation), incorporating the change.`;
  }

  return `Generate a ${input.duration.days}-day itinerary:
- From: ${input.origin}
- To: ${input.destination}
- Primary Vibe: ${input.vibe.primary}${secondaryVibe}
- Interests: ${input.interests.join(", ")}
- Purpose: ${input.purpose.join(", ")}
- Duration: ${input.duration.days} days${extraCtx}

IMPORTANT: The destination is ${input.destination}. All activities and places must be IN or very near ${input.destination}. Do NOT suggest places in ${input.origin} — that is just the departure point.

Known real activities often done in ${input.destination} (use these when they fit the vibe; do not invent prices): ${destActivities}

Every day needs 3+ specific named places AND a clear activities[] list with correct categories (include water/air/adventure when this destination is known for them). Skip tourist-trap filler. Do NOT invent cost numbers.`;
}
