/**
 * Read a `data: {json}` event stream (as sent by /api/generate and
 * /api/wizard) and yield each parsed event. Malformed lines are skipped.
 */
export interface StreamEvent {
  type: string;
  data?: unknown;
}

export async function* readEventStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parse = (line: string): StreamEvent | null => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return null;
    try {
      return JSON.parse(trimmed.slice(6)) as StreamEvent;
    } catch {
      return null;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const event = parse(line);
      if (event) yield event;
    }
  }

  // Flush a trailing payload that lacked a final newline
  const trailing = parse(buffer);
  if (trailing) yield trailing;
}
