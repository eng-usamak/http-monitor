import { describe, expect, it, vi } from 'vitest';
import { pollOnce, type FetchFn } from './poller.js';

const URL = 'https://example.test/anything';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('pollOnce', () => {
  it('records a successful response with parsed body and timing', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(jsonResponse({ echo: true }));

    const record = await pollOnce({ fetchFn, url: URL });

    expect(record.ok).toBe(true);
    expect(record.statusCode).toBe(200);
    expect(record.responseBody).toEqual({ echo: true });
    expect(record.error).toBeNull();
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(record.responseSize).toBeGreaterThan(0);
  });

  it('sends a random JSON payload via POST', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(jsonResponse({}));

    const record = await pollOnce({ fetchFn, url: URL });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchFn.mock.calls[0];
    expect(calledUrl).toBe(URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual(record.requestPayload);
    expect(record.requestPayload.probeId).toBeDefined();
  });

  it('records non-2xx responses as errors with the body preserved', async () => {
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(jsonResponse({ oops: 1 }, 503));

    const record = await pollOnce({ fetchFn, url: URL });

    expect(record.ok).toBe(false);
    expect(record.statusCode).toBe(503);
    expect(record.error).toBe('HTTP 503');
    expect(record.responseBody).toEqual({ oops: 1 });
  });

  it('retries once after a network failure and succeeds', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(jsonResponse({ retried: true }));

    const record = await pollOnce({ fetchFn, url: URL });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(record.ok).toBe(true);
    expect(record.responseBody).toEqual({ retried: true });
  });

  it('records an error result when both attempts fail', async () => {
    const fetchFn = vi.fn<FetchFn>().mockRejectedValue(new Error('connect ECONNREFUSED'));

    const record = await pollOnce({ fetchFn, url: URL });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(record.ok).toBe(false);
    expect(record.statusCode).toBeNull();
    expect(record.error).toContain('ECONNREFUSED');
    expect(record.responseBody).toBeNull();
    expect(record.responseSize).toBe(0);
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('stores non-JSON bodies as raw strings', async () => {
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValue(new Response('<html>busy</html>', { status: 200 }));

    const record = await pollOnce({ fetchFn, url: URL });

    expect(record.responseBody).toBe('<html>busy</html>');
  });

  it('truncates oversized bodies instead of storing them', async () => {
    const huge = 'x'.repeat(150_000);
    const fetchFn = vi.fn<FetchFn>().mockResolvedValue(new Response(huge, { status: 200 }));

    const record = await pollOnce({ fetchFn, url: URL });

    expect(record.responseBody).toEqual({ truncated: true, originalSize: 150_000 });
    expect(record.responseSize).toBe(150_000);
  });
});
