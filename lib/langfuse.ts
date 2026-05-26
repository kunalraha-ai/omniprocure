import { Langfuse } from "langfuse";

let _client: Langfuse | null = null;

export function getLangfuseClient(): Langfuse | null {
  if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    return null;
  }
  if (!_client) {
    _client = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
      // Flush immediately — serverless functions terminate right after returning,
      // so timer-based or size-based batching will silently drop events.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

/**
 * Call this at the end of every API route before returning the response.
 * Uses shutdownAsync (drains queue + closes HTTP connection) which is the
 * correct method for serverless — flushAsync only drains the queue but
 * doesn't guarantee the HTTP request completes before the function exits.
 * Never throws — observability must never break the app.
 */
export async function flushLangfuse(): Promise<void> {
  if (!_client) return;
  try {
    await _client.shutdownAsync();
    // Reset singleton so next cold start gets a fresh connection
    _client = null;
  } catch {
    // swallow — never let Langfuse errors surface to users
  }
}
