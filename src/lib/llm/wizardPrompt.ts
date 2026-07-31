import { runTravelWizardGraph } from "./langgraph";

export type { WizardGraphResult as WizardAiResponse } from "./langgraph";

/**
 * Conversational trip intake via LangGraph:
 * classify → (refuse | answer | extract) → ask until clear | finalize on ready
 * Asks clarifying questions; does not anticipate or invent details.
 * Hard-gated to India travel planning only.
 */
export async function runWizardTurn(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  return runTravelWizardGraph(messages);
}
