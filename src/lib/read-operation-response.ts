/** Read completed backend stages; ordinary JSON remains compatible with older servers. */
export async function readOperationResponse(
  response: Response,
  onProgress: (value: number) => void,
): Promise<Record<string, unknown> | null> {
  if (!response.headers.get("content-type")?.includes("application/x-ndjson"))
    return response.json().catch(() => null);
  if (!response.body) return null;
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let pending = "",
    result: Record<string, unknown> | null = null;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as Record<string, unknown>;
    if (typeof event.progress === "number" && Number.isFinite(event.progress))
      onProgress(Math.max(0, Math.min(event.url ? 100 : 99, event.progress)));
    if (event.url || event.error) result = event;
  };
  try {
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) consume(line);
      if (chunk.done) {
        consume(pending);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return result;
}
