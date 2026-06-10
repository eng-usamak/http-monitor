import { logger } from '../../../lib/logger.js';
import { LlmUsageModel } from './usage.model.js';

// Claude Haiku 4.5 pricing (USD per million tokens).
export const PRICE_PER_MTOK_INPUT = 1;
export const PRICE_PER_MTOK_OUTPUT = 5;

// Hard cap on a single request's estimated input, guards runaway prompts.
export const MAX_ESTIMATED_INPUT_TOKENS = 10_000;

/** Cheap pre-call token estimate: ~4 characters per token for English/JSON. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function costUsd(tokensIn: number, tokensOut: number): number {
  return (tokensIn * PRICE_PER_MTOK_INPUT + tokensOut * PRICE_PER_MTOK_OUTPUT) / 1_000_000;
}

/** Sliding-window rate limiter over LLM API calls. */
export class SlidingWindowLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxCalls: number,
    private readonly windowMs: number = 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  private prune(): void {
    const cutoff = this.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
  }

  remaining(): number {
    this.prune();
    return Math.max(0, this.maxCalls - this.timestamps.length);
  }

  /** Reserves `calls` slots atomically; returns false (reserving none) if they don't all fit. */
  tryAcquire(calls = 1): boolean {
    this.prune();
    if (this.timestamps.length + calls > this.maxCalls) return false;
    const t = this.now();
    for (let i = 0; i < calls; i += 1) this.timestamps.push(t);
    return true;
  }
}

/** In-memory TTL cache for repeated questions/summaries. */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}

export function normalizeQuestion(question: string): string {
  return question.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function recordUsage(
  purpose: 'chat' | 'incident' | 'analysis',
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  try {
    await LlmUsageModel.create({
      purpose,
      tokensIn,
      tokensOut,
      costUsd: costUsd(tokensIn, tokensOut),
    });
  } catch (error) {
    // Usage accounting must never break the user-facing flow.
    logger.error({ err: error }, 'failed to record LLM usage');
  }
}

export interface UsageSummary {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  callsRemainingThisHour: number;
  maxCallsPerHour: number;
}

export async function getUsageSummary(
  limiter: SlidingWindowLimiter,
  maxCallsPerHour: number,
): Promise<UsageSummary> {
  const [row] = await LlmUsageModel.aggregate<{
    totalCalls: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCostUsd: number;
  }>([
    {
      $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        totalTokensIn: { $sum: '$tokensIn' },
        totalTokensOut: { $sum: '$tokensOut' },
        totalCostUsd: { $sum: '$costUsd' },
      },
    },
  ]);

  return {
    totalCalls: row?.totalCalls ?? 0,
    totalTokensIn: row?.totalTokensIn ?? 0,
    totalTokensOut: row?.totalTokensOut ?? 0,
    totalCostUsd: row?.totalCostUsd ?? 0,
    callsRemainingThisHour: limiter.remaining(),
    maxCallsPerHour,
  };
}
