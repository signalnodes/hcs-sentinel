/**
 * fetch() wrapper with timeout and simple retry on 429 / network errors.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });

      if (res.status === 429) {
        const raw = Number(res.headers.get('retry-after') ?? 0);
        // Cap at 60s — a server returning a huge retry-after is a DoS vector
        const retryAfter = Math.min(raw, 60);
        const delay = retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS * attempt;
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
      }

      return res;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      // Retry on network errors and aborts (timeout)
      await sleep(RETRY_DELAY_MS * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  // Unreachable but satisfies TypeScript
  throw new Error(`fetch failed after ${MAX_RETRIES} attempts: ${url}`);
}
