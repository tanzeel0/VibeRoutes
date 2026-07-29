import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { GenerateRequestInput } from "@/lib/validation/itinerarySchema";
import type { ItineraryPayload } from "@/types/itinerary";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Hint the model to return JSON via prompt (NIM often rejects response_format) */
  json?: boolean;
}

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "moonshotai/kimi-k2.6";

function getApiKey(): string {
  const key = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY;
  if (!key) {
    throw new Error("NVIDIA_API_KEY not configured");
  }
  return key;
}

/**
 * Direct NVIDIA Integrate call — same endpoint ChatNVIDIA uses under the hood.
 * Mirrors the official build.nvidia.com / LangChain ChatNVIDIA sample.
 */
export async function nvidiaChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const apiKey = getApiKey();
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 16384;

  const body: Record<string, unknown> = {
    model: NVIDIA_MODEL,
    messages,
    temperature,
    top_p: 1,
    max_tokens: maxTokens,
    stream: false,
  };

  const response = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await response.text().catch(() => "");
    throw new Error("LLM provider request failed");
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        reasoning_content?: string;
      };
    }>;
  };

  const message = data.choices?.[0]?.message;
  // Kimi may put chain-of-thought in reasoning_content; we only need final content
  const text = message?.content;
  if (!text) throw new Error("NVIDIA API returned empty content");
  return text;
}

export function parseJsonFromLlm<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1].trim()) as T;
    const brace = text.match(/\{[\s\S]*\}/);
    if (brace) return JSON.parse(brace[0]) as T;
    throw new Error("LLM returned non-JSON response");
  }
}

export async function generateWithNvidia(
  input: GenerateRequestInput
): Promise<ItineraryPayload> {
  const text = await nvidiaChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
    { temperature: 0.7, maxTokens: 16384, json: true }
  );
  return parseJsonFromLlm<ItineraryPayload>(text);
}

export const nvidiaClient = {
  generateItinerary: generateWithNvidia,
};

export function nvidiaModelLabel(): string {
  return NVIDIA_MODEL.includes("/")
    ? NVIDIA_MODEL.split("/").pop() || NVIDIA_MODEL
    : NVIDIA_MODEL;
}
