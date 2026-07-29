import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { GenerateRequestInput } from "@/lib/validation/itinerarySchema";
import type { ItineraryPayload } from "@/types/itinerary";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { invokeTravelModel, getSelectedProvider } from "./model";
import { llmItinerarySchema, type LlmItinerary } from "./schemas";
import { nvidiaClient } from "../nvidiaClient";
import { geminiClient } from "../geminiClient";
import { groqClient } from "../groqClient";

const ItineraryState = Annotation.Root({
  input: Annotation<GenerateRequestInput>,
  rawText: Annotation<string>,
  parsed: Annotation<LlmItinerary | null>,
  error: Annotation<string | null>,
  attempts: Annotation<number>,
});

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1].trim());
    const brace = trimmed.match(/\{[\s\S]*\}/);
    if (brace) return JSON.parse(brace[0]);
    throw new Error("Itinerary model returned non-JSON");
  }
}

async function nodeGenerate(state: typeof ItineraryState.State) {
  const userPrompt = buildUserPrompt(state.input);
  const repair =
    state.error && state.attempts > 0
      ? `\n\nPREVIOUS OUTPUT FAILED VALIDATION: ${state.error}\nFix the JSON to match the required schema exactly.`
      : "";

  const res = await invokeTravelModel(
    [
      new SystemMessage(
        SYSTEM_PROMPT +
          "\n\nHARD DOMAIN LOCK: Only plan leisure travel in India for the given origin/destination. No off-topic content. Return ONLY JSON."
      ),
      new HumanMessage(userPrompt + repair),
    ],
    {
      temperature: 0.7,
      maxTokens: 8192,
      jsonMode: true,
    }
  );

  const rawText =
    typeof res.content === "string"
      ? res.content
      : JSON.stringify(res.content);
  return { rawText, attempts: state.attempts + 1, error: null };
}

async function nodeValidate(state: typeof ItineraryState.State) {
  try {
    const json = extractJsonObject(state.rawText);
    const parsed = llmItinerarySchema.parse(json);

    // Domain checks
    const dest = state.input.destination.toLowerCase();
    if (parsed.itinerary.length < 1) {
      return { error: "itinerary array empty", parsed: null };
    }
    if (parsed.itinerary.length > 10) {
      parsed.itinerary = parsed.itinerary.slice(0, 10);
    }
    // Soft check: titles/descriptions should mention destination-ish content
    const blob = `${parsed.title} ${parsed.route_summary}`.toLowerCase();
    if (dest && !blob.includes(dest.split(",")[0].trim()) && dest.length > 2) {
      // Don't fail hard — enrichment handles geo; just ensure days exist
    }

    return { parsed, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "validation failed";
    return { parsed: null, error: message };
  }
}

function routeAfterValidate(
  state: typeof ItineraryState.State
): "retry" | typeof END {
  if (state.parsed) return END;
  if (state.attempts < 2) return "retry";
  return END;
}

const itineraryGraph = new StateGraph(ItineraryState)
  .addNode("generate", nodeGenerate)
  .addNode("validate", nodeValidate)
  .addEdge(START, "generate")
  .addEdge("generate", "validate")
  .addConditionalEdges("validate", routeAfterValidate, {
    retry: "generate",
    [END]: END,
  });

const compiledItinerary = itineraryGraph.compile();

function toPayload(
  parsed: LlmItinerary,
  input: GenerateRequestInput
): ItineraryPayload {
  return {
    id: "",
    slug: "",
    source: "ai_generated",
    title: parsed.title,
    origin: input.origin,
    destination: input.destination,
    vibe: {
      primary: input.vibe.primary as ItineraryPayload["vibe"]["primary"],
      ...(input.vibe.secondary
        ? {
            secondary:
              input.vibe.secondary as NonNullable<
                ItineraryPayload["vibe"]["secondary"]
              >,
          }
        : {}),
    },
    purpose: input.purpose as ItineraryPayload["purpose"],
    interests: input.interests,
    duration: {
      days: input.duration.days,
      nights: Math.max(1, input.duration.days - 1),
    },
    route_summary: parsed.route_summary,
    places: parsed.itinerary.flatMap((d) =>
      (d.places_visited || []).map((p) => p.name)
    ),
    route_geo: { waypoints: [] },
    tags: parsed.tags || [],
    details: {
      overview: parsed.route_summary,
      highlights: parsed.itinerary.slice(0, 5).map((d) => d.title),
    },
    itinerary: parsed.itinerary.map((d) => ({
      day: d.day,
      title: d.title,
      location: d.location,
      description: d.description,
      activities: d.activities,
      places_visited: d.places_visited,
      meals: d.meals,
    })),
    inclusions: parsed.inclusions || [],
    exclusions: parsed.exclusions || [],
    ai_meta: {
      grounded: true,
      generated_at: new Date().toISOString(),
      model: "langgraph",
    },
  };
}

/**
 * LangGraph itinerary generation with validate+retry.
 * Falls back to legacy clients if the graph cannot run (e.g. gemini-only).
 */
export async function runItineraryGraph(
  input: GenerateRequestInput
): Promise<ItineraryPayload> {
  const provider = getSelectedProvider();

  // Gemini stays on native client (not OpenAI-compatible)
  if (provider === "gemini") {
    return geminiClient.generateItinerary(input);
  }

  try {
    const result = await compiledItinerary.invoke({
      input,
      rawText: "",
      parsed: null,
      error: null,
      attempts: 0,
    });

    if (result.parsed) {
      return toPayload(result.parsed, input);
    }

    // Last-resort legacy NVIDIA/Groq parse
    if (provider === "groq") {
      return groqClient.generateItinerary(input);
    }
    return nvidiaClient.generateItinerary(input);
  } catch (err) {
    console.error("[itineraryGraph] falling back:", err);
    if (provider === "groq") return groqClient.generateItinerary(input);
    return nvidiaClient.generateItinerary(input);
  }
}
