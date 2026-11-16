import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runWizardTurn } from "@/lib/llm/wizardPrompt";
import { runWithModelSwitchNotices } from "@/lib/llm";
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

    const messages = parsed.data.messages;
    const encoder = new TextEncoder();

    // Streamed so the chat can show "switching model" notices while it waits.
    // Events: {type:"notice"} (0+), then one {type:"result"} or {type:"error"}.
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) =>
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );

        try {
          const result = await runWithModelSwitchNotices(
            (notice) =>
              send({ type: "notice", data: { message: notice.message } }),
            () => runWizardTurn(messages)
          );
          // Never echo internal fields — only the public wizard contract
          send({
            type: "result",
            data: {
              reply: result.reply,
              suggestions: result.suggestions,
              done: result.done,
              request: result.done ? result.request : null,
            },
          });
        } catch (error) {
          safeErrorLog("wizard", error);
          send({ type: "error", data: { message: PUBLIC_ERRORS.wizard } });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    safeErrorLog("wizard", error);
    return NextResponse.json(
      { error: PUBLIC_ERRORS.wizard },
      { status: 500 }
    );
  }
}
