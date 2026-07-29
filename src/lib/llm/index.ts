import { geminiClient } from "./geminiClient";
import type { LLMProvider } from "./geminiClient";
import { runItineraryGraph, getModelLabel, getSelectedProvider } from "./langgraph";
import type { GenerateRequestInput } from "@/lib/validation/itinerarySchema";
import type { ItineraryPayload } from "@/types/itinerary";

const selectedProvider = getSelectedProvider();

/** Primary path: LangGraph generate → validate → retry (with legacy fallbacks). */
const langGraphClient: LLMProvider = {
  async generateItinerary(
    input: GenerateRequestInput
  ): Promise<ItineraryPayload> {
    return runItineraryGraph(input);
  },
};

const provider: LLMProvider =
  selectedProvider === "gemini" ? geminiClient : langGraphClient;

export function getLlmModelLabel(): string {
  return getModelLabel();
}

export default provider;
