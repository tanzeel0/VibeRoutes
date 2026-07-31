"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { GenerateRequest, VibeTag, Interest, PurposeTag } from "@/types/itinerary";
import { Sparkles, Send } from "lucide-react";

interface Message {
  id: number;
  role: "ai" | "user";
  text: string;
}

interface ChatWizardProps {
  initialPrompt: string;
  onComplete: (request: GenerateRequest, displayPrompt: string) => void;
}

interface WizardApiResponse {
  reply: string;
  suggestions: string[] | null;
  done: boolean;
  request: GenerateRequest | null;
  error?: string;
}

function buildDisplayPrompt(acc: GenerateRequest): string {
  return `${acc.duration.days}-day ${acc.vibe.primary.replace(/-/g, " ")} trip from ${acc.origin} to ${acc.destination}${
    acc.interests?.length ? ` — interests: ${acc.interests.join(", ")}` : ""
  }`;
}

function normalizeRequest(raw: GenerateRequest): GenerateRequest {
  const days = Number(raw.duration?.days);
  return {
    origin: (raw.origin || "").trim() || "Delhi",
    destination: (raw.destination || "").trim(),
    vibe: {
      primary: (raw.vibe?.primary || "street-food") as VibeTag,
      secondary: raw.vibe?.secondary as VibeTag | undefined,
    },
    interests:
      raw.interests?.length > 0
        ? (raw.interests as Interest[])
        : (["street food"] as Interest[]),
    purpose:
      raw.purpose?.length > 0
        ? (raw.purpose as PurposeTag[])
        : (["leisure"] as PurposeTag[]),
    duration: {
      days: Number.isFinite(days)
        ? Math.min(10, Math.max(1, Math.round(days)))
        : 4,
    },
    extra_context: raw.extra_context?.trim() || undefined,
  };
}

export default function ChatWizard({ initialPrompt, onComplete }: ChatWizardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [isThinking, setIsThinking] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const startedRef = useRef(false);
  const completingRef = useRef(false);

  const pushMessage = useCallback((role: "ai" | "user", text: string) => {
    const id = ++nextId.current;
    setMessages((prev) => [...prev, { id, role, text }]);
    return id;
  }, []);

  const callWizard = useCallback(
    async (history: Array<{ role: "user" | "assistant"; content: string }>) => {
      setIsThinking(true);
      setError(null);
      setSuggestions(null);

      try {
        const res = await fetch("/api/wizard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        const data = (await res.json()) as WizardApiResponse;
        if (!res.ok) {
          throw new Error("wizard_unavailable");
        }

        pushMessage("ai", data.reply);
        historyRef.current = [
          ...history,
          { role: "assistant", content: data.reply },
        ];

        if (data.done && data.request && !completingRef.current) {
          completingRef.current = true;
          setIsComplete(true);
          setSuggestions(null);
          const finalReq = normalizeRequest(data.request);
          setTimeout(() => onComplete(finalReq, buildDisplayPrompt(finalReq)), 600);
          return;
        }

        setSuggestions(
          data.suggestions && data.suggestions.length > 0
            ? data.suggestions
            : null
        );
      } catch {
        setError("planner_unavailable");
        pushMessage(
          "ai",
          "I hit a snag talking to the planner. Please try again in a moment."
        );
      } finally {
        setIsThinking(false);
        setTimeout(() => textInputRef.current?.focus(), 120);
      }
    },
    [onComplete, pushMessage]
  );

  // Kick off with the user's initial prompt
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const opener = initialPrompt.trim() || "I want help planning a trip in India.";
    pushMessage("user", opener);
    historyRef.current = [{ role: "user", content: opener }];
    void callWizard(historyRef.current);
  }, [initialPrompt, callWizard, pushMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, suggestions, isThinking]);

  const sendUserText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking || isComplete) return;

    pushMessage("user", trimmed);
    setInputValue("");
    setSuggestions(null);
    const nextHistory = [
      ...historyRef.current,
      { role: "user" as const, content: trimmed },
    ];
    historyRef.current = nextHistory;
    void callWizard(nextHistory);
  };

  const handleTextSubmit = () => sendUserText(inputValue);

  const handleSuggestion = (label: string) => sendUserText(label);

  const handleRetry = () => {
    if (isThinking || isComplete) return;
    void callWizard(historyRef.current);
  };

  return (
    <div className="chat-wizard">
      <div className="wizard-shell">
        <div className="wizard-messages">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`wizard-msg ${msg.role}`}
              style={{ ["--vr-stagger" as string]: `${Math.min(index, 8) * 45}ms` }}
            >
              {msg.role === "ai" ? (
                <div className="avatar-circle ai-avatar" aria-hidden>
                  <Sparkles size={14} />
                </div>
              ) : (
                <div className="avatar-circle user-avatar" aria-hidden>
                  You
                </div>
              )}
              <div className={`wizard-bubble ${msg.role}`}>{msg.text}</div>
            </div>
          ))}

          {isThinking && (
            <div
              className="wizard-msg ai"
              style={{ ["--vr-stagger" as string]: "40ms" }}
            >
              <div className="avatar-circle ai-avatar" aria-hidden>
                <Sparkles size={14} />
              </div>
              <div className="wizard-bubble ai wizard-thinking" aria-live="polite">
                <span className="wizard-thinking-label">Planning</span>
                <span className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {!isComplete && (
        <div className="wizard-input-area">
          <div className="wizard-composer">
            {suggestions && suggestions.length > 0 && !isThinking && (
              <div className="wizard-chip-row">
                <p className="wizard-chip-label">Quick picks</p>
                <div className="wizard-chips">
                  {suggestions.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="wizard-chip"
                      onClick={() => handleSuggestion(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="wizard-text-row prompt-input-wrapper">
              <input
                ref={textInputRef}
                type="text"
                className="wizard-text-input"
                placeholder={
                  isThinking
                    ? "Waiting for reply..."
                    : "Ask anything or answer the question..."
                }
                value={inputValue}
                disabled={isThinking}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTextSubmit();
                }}
              />
              <button
                className="prompt-submit"
                onClick={handleTextSubmit}
                disabled={isThinking || !inputValue.trim()}
                type="button"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </div>

            {error && (
              <div className="wizard-skip">
                <button className="wizard-chip" type="button" onClick={handleRetry}>
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
