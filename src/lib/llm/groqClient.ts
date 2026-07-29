import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { GenerateRequestInput } from "@/lib/validation/itinerarySchema";
import type { ItineraryPayload } from "@/types/itinerary";
import type { LLMProvider } from "./geminiClient";

async function generateWithGroq(
  input: GenerateRequestInput
): Promise<ItineraryPayload> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error("LLM provider request failed");
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  return JSON.parse(text) as ItineraryPayload;
}

export const groqClient: LLMProvider = {
  generateItinerary: generateWithGroq,
};
