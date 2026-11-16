import type { LLMProvider } from "./geminiClient";
import { runItineraryGraph, getModelLabel } from "./langgraph";
import type { GenerateRequestInput } from "@/lib/validation/itinerarySchema";
import type { ItineraryPayload } from "@/types/itinerary";

/**
 * LangGraph generate -> validate -> retry. The model behind it is chosen by
 * invokeTravelModel: Groq first, then Gemini, then NVIDIA, switching whenever
 * one does not answer within 60s.
 */
const provider: LLMProvider = {
  async generateItinerary(
    input: GenerateRequestInput
  ): Promise<ItineraryPayload> {
    return runItineraryGraph(input);
  },
};

export function getLlmModelLabel(): string {
  return getModelLabel();
}

export { runWithModelSwitchNotices } from "./langgraph";
export type { ModelSwitchNotice } from "./langgraph";

export default provider;
