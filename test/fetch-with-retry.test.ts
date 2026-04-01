import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// fetchWithRetry uses the global fetch — we mock it per test
const { fetchWithRetry } = await import('../src/utils/fetch-with-retry.js');

function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status,
    headers,
  });
}

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns response immediately on success', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(200));
    const res = await fetchWithRetry('https://example.com');
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns non-retryable error responses without retry', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(404));
    const res = await fetchWithRetry('https://example.com');
    expect(res.status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and eventually succeeds', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(429))
      .mockResolvedValueOnce(makeResponse(429))
      .mockResolvedValue(makeResponse(200));

    const promise = fetchWithRetry('https://example.com');
    // Advance timers through retry delays
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('respects retry-after header on 429', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': '5' }))
      .mockResolvedValue(makeResponse(200));

    const promise = fetchWithRetry('https://example.com');
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(200);
    vi.useRealTimers();
  });

  it('returns last 429 after exhausting retries', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(makeResponse(429));

    const promise = fetchWithRetry('https://example.com');
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(3); // MAX_RETRIES
    vi.useRealTimers();
  });

  it('retries on network error and succeeds', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue(makeResponse(200));

    const promise = fetchWithRetry('https://example.com');
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(200);
    vi.useRealTimers();
  });

  it('throws after exhausting retries on network error', async () => {
    vi.useFakeTimers();
    // Use mockImplementation to avoid unhandled rejection warnings from mockRejectedValue
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new Error('network error')));

    const promise = fetchWithRetry('https://example.com').catch(e => e);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('network error');
    expect(fetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
