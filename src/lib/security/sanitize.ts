/**
 * Server-side security helpers — never send secrets, stacks, or provider
 * internals to the browser.
 */

const SECRET_PATTERNS: RegExp[] = [
  /nvapi-[A-Za-z0-9_-]+/gi,
  /gsk_[A-Za-z0-9_-]+/gi,
  /\bsk-[A-Za-z0-9]{20,}/gi,
  /\bAIza[0-9A-Za-z_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._\-+=\/]+/gi,
  /postgresql:\/\/[^\s"'`]+/gi,
  /mysql:\/\/[^\s"'`]+/gi,
  /mongodb(\+srv)?:\/\/[^\s"'`]+/gi,
  /(NVIDIA_API_KEY|GROQ_API_KEY|GEMINI_API_KEY|UNSPLASH_ACCESS_KEY|DATABASE_URL|API_KEY|apiKey|api_key)\s*[=:]\s*[^\s"'`,}]+/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
];

const INTERNAL_HINTS: RegExp[] = [
  /Troubleshooting URL:\s*\S+/gi,
  /docs\.langchain\.com\S*/gi,
  /MODEL_NOT_FOUND/gi,
  /status code \(no body\)/gi,
  /at\s+[\w./\\-]+\.(ts|js|mjs):\d+/gi,
  /node_modules[\\/][^\s]+/gi,
  /integrate\.api\.nvidia\.com\S*/gi,
  /api\.groq\.com\S*/gi,
  /generativelanguage\.googleapis\.com\S*/gi,
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  for (const re of INTERNAL_HINTS) {
    out = out.replace(re, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Safe message for API clients / UI — never leaks provider or credential details. */
export function toPublicError(
  _err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  return fallback;
}

export function safeErrorLog(label: string, err: unknown): void {
  if (process.env.NODE_ENV === "production") {
    const msg =
      err instanceof Error ? redactSecrets(err.message) : "unknown error";
    console.error(`[${label}]`, msg);
    return;
  }
  // Dev: still redact secrets even if stacks help debugging
  if (err instanceof Error) {
    console.error(`[${label}]`, redactSecrets(err.message));
    if (err.stack) console.error(redactSecrets(err.stack));
  } else {
    console.error(`[${label}]`, redactSecrets(String(err)));
  }
}

export const PUBLIC_ERRORS = {
  wizard: "The trip planner is temporarily unavailable. Please try again.",
  generate: "Could not build your itinerary right now. Please try again.",
  validation: "Invalid request. Check your trip details and try again.",
  notFound: "Not found.",
  rateLimited: "Too many requests. Wait a moment and try again.",
  unauthorized: "Unauthorized.",
} as const;
