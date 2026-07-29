import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runWizardTurn } from "@/lib/llm/wizardPrompt";
import { PUBLIC_ERRORS, safeErrorLog } from "@/lib/security/sanitize";
import { clientKey, rateLimit } from "@/lib/security/rateLimit";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit({
    key: clientKey(req, "wizard"),
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: PUBLIC_ERRORS.rateLimited },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      }
    );
  }

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: PUBLIC_ERRORS.validation },
        { status: 400 }
      );
    }

    const result = await runWizardTurn(parsed.data.messages);
    // Never echo internal fields — only the public wizard contract
    return NextResponse.json({
      reply: result.reply,
      suggestions: result.suggestions,
      done: result.done,
      request: result.done ? result.request : null,
    });
  } catch (error) {
    safeErrorLog("wizard", error);
    return NextResponse.json(
      { error: PUBLIC_ERRORS.wizard },
      { status: 500 }
    );
  }
}
