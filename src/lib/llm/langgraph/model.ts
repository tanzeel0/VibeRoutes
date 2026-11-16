import { AsyncLocalStorage } from "node:async_hooks";
import { ChatOpenAI } from "@langchain/openai";
import { safeErrorLog } from "@/lib/security/sanitize";

export type TravelLlmProvider = "nvidia" | "groq" | "gemini";

/**
 * A model that has not answered within this window is abandoned for the next
 * one. 60s by default; LLM_SWITCH_TIMEOUT_MS overrides it (handy for testing).
 */
export function getModelSwitchTimeoutMs(): number {
  const raw = Number(process.env.LLM_SWITCH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? raw : 60_000;
}
/** After a model fails, skip it for a while so later calls don't wait on it again. */
const PROVIDER_COOLDOWN_MS = 5 * 60_000;
const DEFAULT_MAX_TOKENS = 4096;

/** Fallback order: Groq first, then Gemini, then NVIDIA. */
const DEFAULT_PROVIDER_ORDER: TravelLlmProvider[] = ["groq", "gemini", "nvidia"];

const groqModelName = () => process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const geminiModelName = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
const nvidiaModelName = () =>
  process.env.NVIDIA_MODEL || "moonshotai/kimi-k2.6";

export function getSelectedProvider(): TravelLlmProvider {
  const raw = process.env.LLM_PROVIDER?.toLowerCase().trim() || "groq";
  if (raw === "nvidia") return "nvidia";
  if (raw === "gemini") return "gemini";
  return "groq";
}

/** Preferred provider first, then the rest in the default order. */
function getProviderOrder(): TravelLlmProvider[] {
  const preferred = getSelectedProvider();
  return [preferred, ...DEFAULT_PROVIDER_ORDER.filter((p) => p !== preferred)];
}

function isConfigured(provider: TravelLlmProvider): boolean {
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return Boolean(process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY);
}

function shortModelName(model: string): string {
  return model.includes("/") ? model.split("/").pop() || model : model;
}

function providerModelName(provider: TravelLlmProvider): string {
  if (provider === "groq") return shortModelName(groqModelName());
  if (provider === "gemini") return shortModelName(geminiModelName());
  return shortModelName(nvidiaModelName());
}

/** Human-readable name shown in the UI, e.g. "Groq (gpt-oss-120b)". */
export function describeProvider(provider: TravelLlmProvider): string {
  const brand =
    provider === "groq" ? "Groq" : provider === "gemini" ? "Gemini" : "NVIDIA";
  return `${brand} (${providerModelName(provider)})`;
}

export interface ModelSwitchNotice {
  from: TravelLlmProvider;
  to: TravelLlmProvider;
  reason: "timeout" | "invalid" | "error";
  message: string;
}

const switchListeners = new AsyncLocalStorage<
  (notice: ModelSwitchNotice) => void
>();

/**
 * Run `fn` and report every model switch that happens inside it, so the
 * caller can show "X didn't respond — switching to Y" to the user.
 */
export function runWithModelSwitchNotices<T>(
  listener: (notice: ModelSwitchNotice) => void,
  fn: () => Promise<T>
): Promise<T> {
  return switchListeners.run(listener, fn);
}

// Kept on globalThis so dev hot-reloads don't forget which providers are down
const providerState = globalThis as unknown as {
  __llmCooldownUntil?: Partial<Record<TravelLlmProvider, number>>;
  __llmLastUsed?: TravelLlmProvider;
};

type ModelOptions = {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
};

function createGroqModel(options?: ModelOptions): ChatOpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("LLM provider is not configured");
  }
  return new ChatOpenAI({
    model: groqModelName(),
    apiKey,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    timeout: getModelSwitchTimeoutMs(),
    maxRetries: 0,
    configuration: { baseURL: "https://api.groq.com/openai/v1" },
    modelKwargs: options?.jsonMode
      ? { response_format: { type: "json_object" } }
      : undefined,
  });
}

/** Gemini through Google's OpenAI-compatible endpoint. */
function createGeminiModel(options?: ModelOptions): ChatOpenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("LLM provider is not configured");
  }
  return new ChatOpenAI({
    model: geminiModelName(),
    apiKey,
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
    timeout: getModelSwitchTimeoutMs(),
    maxRetries: 0,
    configuration: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    },
    modelKwargs: options?.jsonMode
      ? { response_format: { type: "json_object" } }
      : undefined,
  });
}

/**
 * JS equivalent of Python ChatNVIDIA via OpenAI-compatible NVIDIA Integrate API.
 */
function createNvidiaModel(options?: ModelOptions): ChatOpenAI {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM provider is not configured");
  }

  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

  return new ChatOpenAI({
    model: nvidiaModelName(),
    apiKey,
    temperature: options?.temperature ?? 0.7,
    maxTokens,
    timeout: getModelSwitchTimeoutMs(),
    maxRetries: 0,
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

function createModel(
  provider: TravelLlmProvider,
  options?: ModelOptions
): ChatOpenAI {
  if (provider === "groq") return createGroqModel(options);
  if (provider === "gemini") return createGeminiModel(options);
  return createNvidiaModel(options);
}

export function getTravelChatModel(
  options?: ModelOptions & { forceProvider?: TravelLlmProvider }
): ChatOpenAI {
  const provider =
    options?.forceProvider ||
    getProviderOrder().find(isConfigured) ||
    getSelectedProvider();
  return createModel(provider, options);
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

export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string };
  const msg = String(e.message || "");
  return e.status === 429 || msg.includes("429") || msg.includes("Too Many Requests");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ChatInput = Parameters<ChatOpenAI["invoke"]>[0];

class ModelTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Model did not respond within ${timeoutMs / 1000}s`);
    this.name = "ModelTimeoutError";
  }
}

/** The model answered, but with nothing usable (empty, or not JSON when JSON was required). */
class ModelInvalidReplyError extends Error {
  constructor(detail: string) {
    super(`Model returned an unusable reply: ${detail}`);
    this.name = "ModelInvalidReplyError";
  }
}

function replyText(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content ?? "");
}

function containsJsonObject(text: string): boolean {
  const candidates = [
    text.trim(),
    text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim(),
    text.match(/\{[\s\S]*\}/)?.[0],
  ];
  return candidates.some((candidate) => {
    if (!candidate) return false;
    try {
      JSON.parse(candidate);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * One provider attempt under a single 60s timer. Rate-limit retries share the
 * same timer, so a provider can never hold the request longer than the window.
 */
async function invokeWithTimer(
  model: ChatOpenAI,
  messages: ChatInput,
  retries = 2
) {
  const timeoutMs = getModelSwitchTimeoutMs();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await model.invoke(messages, { signal: controller.signal });
      } catch (err) {
        if (timedOut) throw new ModelTimeoutError(timeoutMs);
        if (attempt >= retries || !isRateLimitError(err)) throw err;
        safeErrorLog("llm-rate-limit-retry", err);
        await sleep(500 * 2 ** attempt);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call the preferred model; if it has not answered within 60s (or errors, or
 * returns an unusable reply),
 * switch to the next one in the order Groq → Gemini → NVIDIA. Each switch is
 * reported through runWithModelSwitchNotices so the UI can show it.
 */
export async function invokeTravelModel(
  messages: ChatInput,
  options?: ModelOptions
) {
  const configured = getProviderOrder().filter(isConfigured);
  if (configured.length === 0) {
    throw new Error("LLM provider is not configured");
  }

  const cooldowns = (providerState.__llmCooldownUntil ??= {});
  const now = Date.now();
  const healthy = configured.filter((p) => (cooldowns[p] ?? 0) <= now);
  // If every provider is cooling down, try them all again rather than fail outright
  const candidates = healthy.length > 0 ? healthy : configured;
  const notify = switchListeners.getStore();
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i++) {
    const provider = candidates[i];
    try {
      const res = await invokeWithTimer(
        createModel(provider, options),
        messages
      );
      const text = replyText(res.content).trim();
      if (!text) throw new ModelInvalidReplyError("empty");
      if (options?.jsonMode && !containsJsonObject(text)) {
        throw new ModelInvalidReplyError("not JSON");
      }
      providerState.__llmLastUsed = provider;
      return res;
    } catch (err) {
      lastError = err;
      const reason =
        err instanceof ModelTimeoutError
          ? "timeout"
          : err instanceof ModelInvalidReplyError
            ? "invalid"
            : "error";
      // One bad reply is not worth benching a provider for; outages are
      if (reason !== "invalid") {
        cooldowns[provider] = Date.now() + PROVIDER_COOLDOWN_MS;
      }
      safeErrorLog(`llm-fallback-${provider}`, err);

      const next = candidates[i + 1];
      if (next && notify) {
        const from = describeProvider(provider);
        const to = describeProvider(next);
        const seconds = Math.round(getModelSwitchTimeoutMs() / 1000);
        notify({
          from: provider,
          to: next,
          reason,
          message:
            reason === "timeout"
              ? `${from} didn't respond in ${seconds}s — switching to ${to}`
              : reason === "invalid"
                ? `${from} returned an invalid reply — switching to ${to}`
                : `${from} failed — switching to ${to}`,
        });
      }
    }
  }

  throw lastError;
}

/** Label of the model that actually answered last (falls back to the preferred one). */
export function getModelLabel(): string {
  return providerModelName(
    providerState.__llmLastUsed ?? getSelectedProvider()
  );
}
