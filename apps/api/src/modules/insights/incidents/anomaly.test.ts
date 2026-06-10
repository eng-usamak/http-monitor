import { describe, expect, it } from 'vitest';
import { evaluateAnomaly } from './anomaly.js';

describe('evaluateAnomaly', () => {
  it('flags durations above 2x the baseline average', () => {
    const verdict = evaluateAnomaly(2100, 1000, 10);
    expect(verdict.isAnomaly).toBe(true);
    expect(verdict.severity).toBe('warning');
    expect(verdict.ratio).toBeCloseTo(2.1);
  });

  it('does not flag durations at or below 2x the baseline', () => {
    expect(evaluateAnomaly(2000, 1000, 10).isAnomaly).toBe(false);
    expect(evaluateAnomaly(900, 1000, 10).isAnomaly).toBe(false);
  });

  it('escalates to critical at 3x and above', () => {
    expect(evaluateAnomaly(3000, 1000, 10).severity).toBe('critical');
    expect(evaluateAnomaly(2900, 1000, 10).severity).toBe('warning');
  });

  it('never fires with too few baseline samples', () => {
    expect(evaluateAnomaly(10_000, 100, 4).isAnomaly).toBe(false);
  });

  it('never fires with a missing or zero baseline', () => {
    expect(evaluateAnomaly(10_000, null, 100).isAnomaly).toBe(false);
    expect(evaluateAnomaly(10_000, 0, 100).isAnomaly).toBe(false);
  });
});
