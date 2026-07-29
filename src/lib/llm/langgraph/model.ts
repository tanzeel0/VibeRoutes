import { ChatOpenAI } from "@langchain/openai";
import { safeErrorLog } from "@/lib/security/sanitize";

export type TravelLlmProvider = "nvidia" | "groq" | "gemini";

export function getSelectedProvider(): TravelLlmProvider {
  const raw = process.env.LLM_PROVIDER?.toLowerCase().trim() || "nvidia";
  if (raw === "groq") return "groq";
  if (raw === "gemini") return "gemini";
  return "nvidia";
}

function createGroqModel(options?: {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): ChatOpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("LLM provider is not configured");
  }
  return new ChatOpenAI({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    apiKey,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 4096,
    configuration: { baseURL: "https://api.groq.com/openai/v1" },
    modelKwargs: options?.jsonMode
      ? { response_format: { type: "json_object" } }
      : undefined,
  });
}

/**
 * JS equivalent of Python ChatNVIDIA via OpenAI-compatible NVIDIA Integrate API.
 */
function createNvidiaModel(options?: {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): ChatOpenAI {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM provider is not configured");
  }

  const maxTokens = options?.maxTokens ?? 16384;

  return new ChatOpenAI({
    model: process.env.NVIDIA_MODEL || "moonshotai/kimi-k2.6",
    apiKey,
    temperature: options?.temperature ?? 0.7,
    maxTokens,
    topP: 1,
    configuration: {
      baseURL: "https://integrate.api.nvidia.com/v1",
    },
    modelKwargs: {
      top_p: 1,
      max_completion_tokens: maxTokens,
    },
  });
}

export function getTravelChatModel(options?: {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  forceProvider?: "nvidia" | "groq";
}): ChatOpenAI {
  const provider = options?.forceProvider || getSelectedProvider();

  if (provider === "groq") {
    return createGroqModel(options);
  }

  try {
    return createNvidiaModel(options);
  } catch (err) {
    if (process.env.GROQ_API_KEY) {
      safeErrorLog("llm-fallback-init", err);
      return createGroqModel(options);
    }
    throw err;
  }
}

export function isModelNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string; lc_error_code?: string };
  const msg = String(e.message || "");
  return (
    e.status === 404 ||
    e.lc_error_code === "MODEL_NOT_FOUND" ||
    msg.includes("MODEL_NOT_FOUND") ||
    msg.includes("404 status code") ||
    msg.includes("Not found for account")
  );
}

type ChatInput = Parameters<ChatOpenAI["invoke"]>[0];

export async function invokeTravelModel(
  messages: ChatInput,
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
) {
  const preferred = getSelectedProvider();

  if (preferred === "groq") {
    return createGroqModel(options).invoke(messages);
  }

  if (process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY) {
    try {
      return await createNvidiaModel({
        ...options,
        maxTokens: options?.maxTokens ?? 16384,
      }).invoke(messages);
    } catch (err) {
      if (!process.env.GROQ_API_KEY) throw err;
      safeErrorLog("llm-fallback", err);
      return createGroqModel(options).invoke(messages);
    }
  }

  if (process.env.GROQ_API_KEY) {
    return createGroqModel(options).invoke(messages);
  }

  throw new Error("LLM provider is not configured");
}

export function getModelLabel(): string {
  const provider = getSelectedProvider();
  if (provider === "groq") return "llama-3.3-70b";
  if (provider === "gemini") return "gemini-2.0-flash";
  const model = process.env.NVIDIA_MODEL || "moonshotai/kimi-k2.6";
  return model.includes("/") ? model.split("/").pop() || model : model;
}
