import { performance } from 'node:perf_hooks';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import type { JsonValue, NewResponseRecord } from '../responses/response.types.js';
import { generatePayload } from './payload.js';

const MAX_STORED_BODY_BYTES = 100_000;

export type FetchFn = typeof fetch;

interface PollOptions {
  fetchFn?: FetchFn;
  url?: string;
  timeoutMs?: number;
}

async function requestOnce(
  url: string,
  body: string,
  timeoutMs: number,
  fetchFn: FetchFn,
): Promise<Response> {
  return fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function truncateBody(raw: string): { body: JsonValue | null; size: number } {
  const size = Buffer.byteLength(raw);
  if (size > MAX_STORED_BODY_BYTES) {
    return { body: { truncated: true, originalSize: size }, size };
  }
  try {
    return { body: JSON.parse(raw) as JsonValue, size };
  } catch {
    return { body: raw, size };
  }
}

/**
 * Executes one monitoring tick: sends a random JSON payload to httpbin and
 * captures the outcome. Failures (timeout, network, non-2xx) are returned as
 * records too — a failed probe is monitoring data, not an exception.
 * Network-level failures are retried once before being recorded as errors.
 */
export async function pollOnce(options: PollOptions = {}): Promise<NewResponseRecord> {
  const {
    fetchFn = fetch,
    url = config.httpbinUrl,
    timeoutMs = config.requestTimeoutMs,
  } = options;

  const requestPayload = generatePayload();
  const body = JSON.stringify(requestPayload);
  const start = performance.now();

  let response: Response;
  try {
    try {
      response = await requestOnce(url, body, timeoutMs, fetchFn);
    } catch (firstError) {
      logger.warn({ err: firstError }, 'poll request failed, retrying once');
      response = await requestOnce(url, body, timeoutMs, fetchFn);
    }
  } catch (error) {
    const durationMs = performance.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    return {
      requestPayload,
      statusCode: null,
      ok: false,
      durationMs,
      responseBody: null,
      responseSize: 0,
      error: message,
    };
  }

  const durationMs = performance.now() - start;
  const raw = await response.text();
  const { body: responseBody, size: responseSize } = truncateBody(raw);

  return {
    requestPayload,
    statusCode: response.status,
    ok: response.ok,
    durationMs,
    responseBody,
    responseSize,
    error: response.ok ? null : `HTTP ${response.status}`,
  };
}
