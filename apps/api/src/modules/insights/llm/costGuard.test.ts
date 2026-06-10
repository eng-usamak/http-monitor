import { describe, expect, it } from 'vitest';
import {
  costUsd,
  estimateTokens,
  normalizeQuestion,
  SlidingWindowLimiter,
  TtlCache,
} from './costGuard.js';

describe('estimateTokens', () => {
  it('estimates roughly 4 characters per token, rounding up', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });
});

describe('costUsd', () => {
  it('applies Haiku pricing per million tokens', () => {
    // 1M input ($1) + 1M output ($5)
    expect(costUsd(1_000_000, 1_000_000)).toBe(6);
    expect(costUsd(1000, 500)).toBeCloseTo(0.0035);
  });
});

describe('SlidingWindowLimiter', () => {
  it('allows calls up to the cap and rejects beyond it', () => {
    const now = 0;
    const limiter = new SlidingWindowLimiter(3, 1000, () => now);

    expect(limiter.tryAcquire(2)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(false);
    expect(limiter.remaining()).toBe(0);
  });

  it('rejects multi-call reservations that do not fully fit, reserving nothing', () => {
    const now = 0;
    const limiter = new SlidingWindowLimiter(3, 1000, () => now);

    expect(limiter.tryAcquire(2)).toBe(true);
    expect(limiter.tryAcquire(2)).toBe(false);
    expect(limiter.remaining()).toBe(1);
  });

  it('frees slots after the window slides past old calls', () => {
    let now = 0;
    const limiter = new SlidingWindowLimiter(2, 1000, () => now);

    expect(limiter.tryAcquire(2)).toBe(true);
    expect(limiter.tryAcquire(1)).toBe(false);

    now = 1001;
    expect(limiter.tryAcquire(2)).toBe(true);
  });
});

describe('TtlCache', () => {
  it('returns values until they expire', () => {
    let now = 0;
    const cache = new TtlCache<string>(100, () => now);

    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');

    now = 101;
    expect(cache.get('k')).toBeUndefined();
  });
});

describe('normalizeQuestion', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeQuestion('  What  Is\n the ERROR rate?  ')).toBe('what is the error rate?');
  });
});
