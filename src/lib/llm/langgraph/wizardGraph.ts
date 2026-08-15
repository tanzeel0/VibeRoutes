import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  classifyIntent,
  extractSlots,
  refuseOffTopic,
  answerTravelQuestion,
  askMissingField,
  finalizeReply,
} from "./nodes";
import {
  mergeSlots,
  missingSlotKeys,
  slotsToRequest,
  type TripSlots,
} from "./schemas";

export interface WizardGraphResult {
  reply: string;
  suggestions: string[] | null;
  done: boolean;
  request: ReturnType<typeof slotsToRequest> | null;
  intent?: string;
}

const WizardState = Annotation.Root({
  messages: Annotation<Array<{ role: "user" | "assistant"; content: string }>>,
  latestUser: Annotation<string>,
  conversation: Annotation<string>,
  intent: Annotation<string>,
  slots: Annotation<TripSlots>,
  reply: Annotation<string>,
  suggestions: Annotation<string[] | null>,
  done: Annotation<boolean>,
  missing: Annotation<string[]>,
});

function formatConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
}

function latestUserMessage(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return messages[messages.length - 1]?.content || "";
}

async function nodeBootstrap(state: typeof WizardState.State) {
  const conversation = formatConversation(state.messages);
  const latestUser = latestUserMessage(state.messages);
  const extracted = await extractSlots(conversation);
  return {
    conversation,
    latestUser,
    slots: mergeSlots(state.slots || {}, extracted),
  };
}

async function nodeClassify(state: typeof WizardState.State) {
  const result = await classifyIntent(state.latestUser, state.conversation);
  if (!result.is_travel_related) {
    return { intent: "off_topic" };
  }
  return { intent: result.intent };
}

async function nodeRefuse(state: typeof WizardState.State) {
  const turn = await refuseOffTopic(state.latestUser);
  return {
    reply: turn.reply,
    suggestions: turn.suggestions?.length
      ? turn.suggestions.slice(0, 6)
      : ["Plan a Goa weekend", "4 days in Manali", "Street food in Mumbai"],
    done: false,
  };
}

async function nodeAnswer(state: typeof WizardState.State) {
  const turn = await answerTravelQuestion(state.conversation, state.slots);
  const slots = mergeSlots(state.slots, turn.slots_patch);
  return {
    slots,
    reply: turn.reply,
    suggestions: turn.suggestions,
    done: false,
  };
}

async function nodeRouteSlots(state: typeof WizardState.State) {
  const missing = missingSlotKeys(state.slots);
  return { missing, done: false };
}

async function nodeAsk(state: typeof WizardState.State) {
  // If core slots are filled but user hasn't clearly said "ready", ask to confirm
  const askFor =
    state.missing.length > 0 ? state.missing : (["confirm"] as string[]);
  const turn = await askMissingField(
    state.conversation,
    state.slots,
    askFor
  );
  // Keep travel Q&A context when we also need the next slot question
  const reply =
    state.reply && state.intent === "travel_question"
      ? `${state.reply}\n\n${turn.reply}`
      : turn.reply;
  return {
    reply,
    suggestions: turn.suggestions,
    done: false,
  };
}

async function nodeFinalize(state: typeof WizardState.State) {
  // Only finalize with what the user actually provided — no invented defaults
  const slots: TripSlots = { ...state.slots };
  const turn = await finalizeReply(slots);
  return {
    slots,
    reply: turn.reply || "Got it — building your itinerary now.",
    suggestions: null,
    done: true,
  };
}

function routeAfterClassify(
  state: typeof WizardState.State
): "refuse" | "answer" | "extract" | "finalize_check" {
  if (state.intent === "off_topic") return "refuse";
  if (state.intent === "travel_question") return "answer";
  if (state.intent === "ready") return "finalize_check";
  return "extract";
}

function routeAfterSlots(
  state: typeof WizardState.State
): "ask" | "finalize" | "stay" {
  // Never anticipate — keep asking until slots are clear
  if (state.missing.length > 0) return "ask";
  // Don't auto-generate on travel Q&A
  if (state.intent === "travel_question") return "stay";
  // Only build when the user clearly said they are ready
  if (state.intent === "ready") return "finalize";
  // Slots look full but user hasn't confirmed — ask, don't assume
  return "ask";
}

const wizardGraph = new StateGraph(WizardState)
  .addNode("bootstrap", nodeBootstrap)
  .addNode("classify", nodeClassify)
  .addNode("refuse", nodeRefuse)
  .addNode("answer", nodeAnswer)
  .addNode("route_slots", nodeRouteSlots)
  .addNode("ask", nodeAsk)
  .addNode("finalize", nodeFinalize)
  .addEdge(START, "bootstrap")
  .addEdge("bootstrap", "classify")
  .addConditionalEdges("classify", routeAfterClassify, {
    refuse: "refuse",
    answer: "answer",
    extract: "route_slots",
    finalize_check: "route_slots",
  })
  .addEdge("refuse", END)
  .addEdge("answer", "route_slots")
  .addConditionalEdges("route_slots", routeAfterSlots, {
    ask: "ask",
    finalize: "finalize",
    stay: END,
  })
  .addEdge("ask", END)
  .addEdge("finalize", END);

const compiledWizard = wizardGraph.compile();

export async function runTravelWizardGraph(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<WizardGraphResult> {
  if (!messages.length) {
    throw new Error("Wizard requires at least one message");
  }

  const result = await compiledWizard.invoke({
    messages,
    latestUser: "",
    conversation: "",
    intent: "trip_details",
    slots: {},
    reply: "",
    suggestions: null,
    done: false,
    missing: [],
  });

  if (!result.reply) {
    throw new Error("Travel wizard returned an empty reply");
  }

  if (result.done) {
    const request = slotsToRequest(result.slots);
    if (!request.origin || !request.destination) {
      return {
        reply:
          result.reply +
          " I still need your starting city and destination before I can plan.",
        suggestions: ["Delhi → Manali", "Mumbai → Goa", "Bangalore → Coorg"],
        done: false,
        request: null,
        intent: result.intent,
      };
    }
    return {
      reply: result.reply,
      suggestions: null,
      done: true,
      request,
      intent: result.intent,
    };
  }

  return {
    reply: result.reply,
    suggestions: result.suggestions,
    done: false,
    request: null,
    intent: result.intent,
  };
}
