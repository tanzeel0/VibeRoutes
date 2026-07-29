import { runTravelWizardGraph } from "./langgraph";

export type { WizardGraphResult as WizardAiResponse } from "./langgraph";

/**
 * Conversational trip intake via LangGraph:
 * classify → (refuse | answer | extract) → ask missing | finalize
 * Hard-gated to India travel planning only.
 */
export async function runWizardTurn(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  return runTravelWizardGraph(messages);
}
