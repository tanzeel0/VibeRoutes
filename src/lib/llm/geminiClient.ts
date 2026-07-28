import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { GenerateRequestInput } from "@/lib/validation/itinerarySchema";
import type { ItineraryPayload } from "@/types/itinerary";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface LLMProvider {
  generateItinerary(input: GenerateRequestInput): Promise<ItineraryPayload>;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // in ms
  maxDelay: number; // in ms
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  return Math.min(exponentialDelay, maxDelay);
}

async function generateWithGemini(
  input: GenerateRequestInput,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ItineraryPayload> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
        systemInstruction: SYSTEM_PROMPT,
      });

      const userPrompt = buildUserPrompt(input);
      const result = await model.generateContent(userPrompt);
      const text = result.response.text();

      let parsed: ItineraryPayload;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error("LLM returned non-JSON response");
        }
      }

      return parsed;
    } catch (error) {
      lastError = error as Error;

      // Check if it's a quota/rate limit error (429)
      const isQuotaError =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("quota") ||
          error.message.includes("Quota exceeded"));

      if (!isQuotaError || attempt === retryConfig.maxRetries) {
        // Not a quota error or we've exhausted retries
        throw error;
      }

      // Calculate backoff delay with exponential increase
      const delayMs = calculateBackoffDelay(
        attempt,
        retryConfig.baseDelay,
        retryConfig.maxDelay
      );

      console.warn(
        `Gemini quota exceeded. Retrying in ${delayMs}ms... (Attempt ${attempt + 1}/${retryConfig.maxRetries})`
      );
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("Failed to generate itinerary with Gemini");
}

export const geminiClient: LLMProvider = {
  generateItinerary: generateWithGemini,
};
