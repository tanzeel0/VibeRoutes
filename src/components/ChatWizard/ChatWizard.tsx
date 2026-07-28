"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { GenerateRequest, VibeTag, Interest, PurposeTag } from "@/types/itinerary";
import { VIBE_TAGS, INTEREST_OPTIONS } from "@/types/itinerary";
import { Sparkles, Send } from "lucide-react";

const CITY_SUGGESTIONS = [
  "Delhi", "Mumbai", "Manali", "Goa", "Jaipur", "Shimla",
  "Rishikesh", "Udaipur", "Darjeeling", "Kasol", "Leh", "Hampi",
  "Munnar", "Coorg", "Ooty", "Varanasi",
];

const DURATION_OPTIONS = ["2", "3", "4", "5", "7", "10"];

interface Message {
  id: number;
  role: "ai" | "user";
  text: string;
}

interface ChatWizardProps {
  initialPrompt: string;
  onComplete: (request: GenerateRequest, displayPrompt: string) => void;
}

type StepId = "destination" | "origin" | "duration" | "vibe" | "interests" | "extra";

interface Step {
  id: StepId;
  question: (acc: GenerateRequest) => string;
  type: "text" | "chips" | "chips-multi" | "optional-text";
  chipOptions?: Array<{ value: string; label: string }>;
  process: (acc: GenerateRequest, answer: string) => Partial<GenerateRequest>;
  skipIf?: (acc: GenerateRequest) => boolean;
}

const ALL_STEPS: Step[] = [
  {
    id: "destination",
    question: () => "Where do you want to go?",
    type: "text",
    process: (_acc, answer) => ({ destination: answer.trim() }),
  },
  {
    id: "origin",
    question: () => "Starting from which city?",
    type: "text",
    process: (_acc, answer) => ({ origin: answer.trim() }),
  },
  {
    id: "duration",
    question: () => "How many days is this trip?",
    type: "chips",
    chipOptions: DURATION_OPTIONS.map((d) => ({
      value: d,
      label: `${d} day${parseInt(d) > 1 ? "s" : ""}`,
    })),
    process: (_acc, answer) => ({
      duration: { days: parseInt(answer) },
    }),
  },
  {
    id: "vibe",
    question: () => "What's the vibe?",
    type: "chips",
    chipOptions: VIBE_TAGS.map((v) => ({ value: v, label: v.replace(/-/g, " ") })),
    process: (_acc, answer) => ({ vibe: { primary: answer as VibeTag } }),
  },
  {
    id: "interests",
    question: () => "What are you into? Pick as many as you like — or skip.",
    type: "chips-multi",
    chipOptions: INTEREST_OPTIONS.map((i) => ({ value: i, label: i })),
    process: (_acc, answer) => ({
      interests: answer.split(", ").filter(Boolean) as Interest[],
    }),
  },
  {
    id: "extra",
    question: () =>
      "Anything else? Budget, pace, must-sees, food limits, travel style — or skip to generate.",
    type: "optional-text",
    process: (_acc, answer) => ({ extra_context: answer.trim() || undefined }),
  },
];

function parseInitialPrompt(text: string): Partial<GenerateRequest> {
  const lower = text.toLowerCase();
  const found = CITY_SUGGESTIONS.filter((c) => lower.includes(c.toLowerCase()));

  let destination = "";
  let origin = "";
  let days = 0;
  let vibe: VibeTag | undefined;

  const fromTo = text.match(/from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?:\s*,|\s+for|\s+\d|\s*$)/i);
  if (fromTo) {
    const c1 = CITY_SUGGESTIONS.find((c) => c.toLowerCase() === fromTo[1].trim().toLowerCase());
    const c2 = CITY_SUGGESTIONS.find((c) => c.toLowerCase() === fromTo[2].trim().toLowerCase());
    if (c1) origin = c1;
    if (c2) destination = c2;
  } else if (found.length >= 2) {
    origin = found[0];
    destination = found[1];
  } else if (found.length === 1) {
    destination = found[0];
  }

  const dayMatch = text.match(/(\d+)\s*day/i);
  if (dayMatch) days = Math.min(10, Math.max(1, parseInt(dayMatch[1])));

  const vibeKW: [string, VibeTag][] = [
    ["street food", "street-food"], ["food", "street-food"],
    ["heritage", "heritage-walk"], ["history", "heritage-walk"],
    ["nightlife", "nightlife"], ["party", "nightlife"],
    ["nature", "nature-escape"], ["mountain", "nature-escape"],
    ["music", "indie-music"], ["indie", "indie-music"],
    ["photo", "photography"], ["chill", "monsoon-chill"],
    ["budget", "budget-backpacking"], ["backpack", "budget-backpacking"],
    ["family", "family-mellow"], ["solo", "solo-reset"],
    ["adventure", "nature-escape"],
  ];
  for (const [kw, tag] of vibeKW) {
    if (lower.includes(kw)) { vibe = tag; break; }
  }

  const result: Partial<GenerateRequest> = {};
  if (destination) result.destination = destination;
  if (origin) result.origin = origin;
  if (days) result.duration = { days };
  if (vibe) result.vibe = { primary: vibe };
  return result;
}

function filterSteps(
  acc: GenerateRequest,
  parsed: Partial<GenerateRequest>
): Step[] {
  return ALL_STEPS.filter((step) => {
    if (step.skipIf && step.skipIf(acc)) return false;
    // Only skip when the user already stated it in the initial prompt
    if (step.id === "destination" && parsed.destination) return false;
    if (step.id === "origin" && parsed.origin) return false;
    if (step.id === "duration" && parsed.duration?.days) return false;
    if (step.id === "vibe" && parsed.vibe?.primary) return false;
    return true;
  });
}

function buildDisplayPrompt(acc: GenerateRequest): string {
  return `${acc.duration.days}-day ${acc.vibe.primary.replace(/-/g, " ")} trip from ${acc.origin} to ${acc.destination}${acc.interests?.length ? ` — interests: ${acc.interests.join(", ")}` : ""}`;
}

// The wizard operates as a simple state machine driven by advanceStep().
// No setState inside effects — all mutations happen in event handlers / callbacks.
export default function ChatWizard({ initialPrompt, onComplete }: ChatWizardProps) {
  const parsed = useMemo(() => parseInitialPrompt(initialPrompt), [initialPrompt]);

  const initialAccumulated: GenerateRequest = useMemo(
    () => ({
      origin: parsed.origin || "",
      destination: parsed.destination || "",
      vibe: parsed.vibe || { primary: "street-food" as VibeTag },
      interests: (parsed.interests as Interest[]) || [],
      purpose: ["leisure" as PurposeTag],
      // Placeholder only — duration step is always asked unless days were in the prompt
      duration: parsed.duration || { days: 0 },
      extra_context: parsed.extra_context,
    }),
    [parsed]
  );

  const stepQueue = useMemo(
    () => filterSteps(initialAccumulated, parsed),
    [initialAccumulated, parsed]
  );

  // Build initial messages array once
  const [initialMessages] = useMemo(() => {
    const preFilled: string[] = [];
    if (parsed.destination) preFilled.push(`destination: ${parsed.destination}`);
    if (parsed.origin) preFilled.push(`origin: ${parsed.origin}`);
    if (parsed.duration?.days) preFilled.push(`${parsed.duration.days} days`);
    if (parsed.vibe?.primary) preFilled.push(`vibe: ${parsed.vibe.primary.replace(/-/g, " ")}`);

    const intro: Message = {
      id: 1,
      role: "ai",
      text: preFilled.length > 0
        ? `Got it - ${preFilled.join(", ")}. Confirming a few details.`
        : "A few details to shape your trip.",
    };

    if (stepQueue.length === 0) {
      return [[intro, { id: 2, role: "ai" as const, text: "All set! Generating your itinerary..." }]];
    }
    return [[intro]];
  }, [parsed, stepQueue]);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [stepIdx, setStepIdx] = useState(0);
  const [accumulated, setAccumulated] = useState<GenerateRequest>(initialAccumulated);
  const [inputValue, setInputValue] = useState("");
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [showTextInput, setShowTextInput] = useState(false);
  const [pendingChips, setPendingChips] = useState<Array<{ value: string; label: string }> | null>(null);
  const [pendingIsMulti, setPendingIsMulti] = useState(false);
  const [isComplete, setIsComplete] = useState(stepQueue.length === 0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(initialMessages.length + 1);

  const allDone = stepIdx >= stepQueue.length;
  const currentStep = !allDone ? stepQueue[stepIdx] : null;

  // Show the question for the current step after a delay
  useEffect(() => {
    if (allDone || isComplete) return;

    const step = stepQueue[stepIdx];
    const timer = setTimeout(() => {
      const id = ++nextId.current;
      setMessages((prev) => [...prev, { id, role: "ai", text: step.question(accumulated) }]);

      if (step.type === "chips" && step.chipOptions) {
        setPendingChips(step.chipOptions);
        setPendingIsMulti(false);
        setShowTextInput(false);
      } else if (step.type === "chips-multi" && step.chipOptions) {
        setPendingChips(step.chipOptions);
        setPendingIsMulti(true);
        setMultiSelected([]);
        setShowTextInput(false);
      } else {
        setPendingChips(null);
        setShowTextInput(true);
        setTimeout(() => textInputRef.current?.focus(), 150);
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, allDone, isComplete]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showTextInput, pendingChips]);

  // Fire onComplete when done
  useEffect(() => {
    if (!isComplete) return;
    const finalAcc = {
      ...accumulated,
      duration: {
        days: accumulated.duration?.days > 0 ? accumulated.duration.days : 4,
      },
      interests:
        accumulated.interests?.length > 0
          ? accumulated.interests
          : (["street food"] as Interest[]),
    };
    const prompt = buildDisplayPrompt(finalAcc);
    const timer = setTimeout(() => onComplete(finalAcc, prompt), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  const advanceStep = (answer: string) => {
    const step = stepQueue[stepIdx];
    if (!step) return;

    const userId = ++nextId.current;
    setMessages((prev) => [...prev, { id: userId, role: "user", text: answer || "Skip" }]);

    const updates = step.process(accumulated, answer);
    const newAcc = { ...accumulated, ...updates } as GenerateRequest;

    // Ensure duration is valid before finishing
    if (
      stepIdx + 1 >= stepQueue.length &&
      (!newAcc.duration?.days || newAcc.duration.days < 1)
    ) {
      newAcc.duration = { days: 4 };
    }
    if (!newAcc.interests?.length) {
      newAcc.interests = ["street food" as Interest];
    }

    setAccumulated(newAcc);

    setInputValue("");
    setMultiSelected([]);
    setPendingChips(null);
    setShowTextInput(false);

    const nextIdx = stepIdx + 1;
    if (nextIdx >= stepQueue.length) {
      const doneId = ++nextId.current;
      setMessages((prev) => [...prev, { id: doneId, role: "ai", text: "All set! Generating your itinerary..." }]);
      setStepIdx(nextIdx);
      setIsComplete(true);
    } else {
      setStepIdx(nextIdx);
    }
  };

  const handleTextSubmit = () => {
    if (!inputValue.trim() && currentStep?.type !== "optional-text") return;
    advanceStep(inputValue);
  };

  const handleChipClick = (value: string) => {
    if (pendingIsMulti) {
      setMultiSelected((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else {
      advanceStep(value);
    }
  };

  const handleMultiConfirm = () => {
    if (multiSelected.length === 0) return;
    advanceStep(multiSelected.join(", "));
  };

  const handleSkip = () => advanceStep("");

  return (
    <div className="chat-wizard">
      <div className="wizard-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`wizard-msg ${msg.role}`}>
            {msg.role === "ai" && (
              <div className="avatar-circle ai-avatar"><Sparkles size={14} /></div>
            )}
            <div className={`wizard-bubble ${msg.role}`}>{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!isComplete && (
        <div className="wizard-input-area">
          {pendingChips && (
            <div className="wizard-chip-row">
              <div className="wizard-chips">
                {pendingChips.map((chip) => (
                  <button
                    key={chip.value}
                    className={`wizard-chip ${pendingIsMulti && multiSelected.includes(chip.value) ? "selected" : ""}`}
                    onClick={() => handleChipClick(chip.value)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              {pendingIsMulti && (
                <div className="wizard-skip">
                  {multiSelected.length > 0 ? (
                    <button className="prompt-submit" onClick={handleMultiConfirm} aria-label="Confirm">
                      <Send size={18} />
                    </button>
                  ) : (
                    <button className="wizard-chip" onClick={handleSkip}>Skip</button>
                  )}
                </div>
              )}
            </div>
          )}

          {showTextInput && (
            <div className="wizard-text-row">
              <input
                ref={textInputRef}
                type="text"
                className="wizard-text-input"
                placeholder={
                  currentStep?.id === "destination"
                    ? "e.g. Manali, Goa, Jaipur..."
                    : currentStep?.id === "origin"
                    ? "e.g. Delhi, Mumbai..."
                    : currentStep?.id === "extra"
                    ? "Budget, pace, must-sees..."
                    : "Type your answer..."
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
              />
              <button
                className="prompt-submit"
                onClick={handleTextSubmit}
                disabled={!inputValue.trim() && currentStep?.type !== "optional-text"}
                type="button"
              >
                <Send size={18} />
              </button>
            </div>
          )}

          {currentStep?.type === "optional-text" && showTextInput && (
            <div className="wizard-skip">
              <button className="wizard-chip" onClick={handleSkip} type="button">
                Skip & generate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
