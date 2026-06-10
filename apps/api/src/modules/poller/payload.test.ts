import { describe, expect, it } from 'vitest';
import { generatePayload } from './payload.js';

describe('generatePayload', () => {
  it('produces a JSON-serializable object with expected envelope', () => {
    const payload = generatePayload();

    expect(typeof payload.probeId).toBe('string');
    expect(typeof payload.sentAt).toBe('string');
    expect(payload.data).toBeTypeOf('object');
    expect(() => JSON.stringify(payload)).not.toThrow();
  });

  it('is deterministic for a fixed RNG', () => {
    let calls = 0;
    const rng = () => {
      calls += 1;
      return (calls % 10) / 10;
    };
    const a = JSON.stringify({ ...generatePayload(rng), sentAt: null });

    calls = 0;
    const b = JSON.stringify({ ...generatePayload(rng), sentAt: null });

    expect(a).toBe(b);
  });
});
