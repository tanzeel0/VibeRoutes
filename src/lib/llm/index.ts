import { geminiClient } from "./geminiClient";
import { groqClient } from "./groqClient";
import type { LLMProvider } from "./geminiClient";

const selectedProvider = process.env.LLM_PROVIDER?.toLowerCase().trim() || "gemini";
console.log(`[LLM] LLM_PROVIDER env var: "${process.env.LLM_PROVIDER}"`);
console.log(`[LLM] Selected provider: ${selectedProvider}`);

const provider: LLMProvider =
  selectedProvider === "groq" ? groqClient : geminiClient;

console.log(`[LLM] Using ${selectedProvider === "groq" ? "Groq" : "Gemini"} provider`);

export default provider;
