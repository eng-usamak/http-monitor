import type { IncidentSeverity } from './incident.types.js';

export const ANOMALY_THRESHOLD_RATIO = 2;
export const CRITICAL_THRESHOLD_RATIO = 3;
export const MIN_BASELINE_SAMPLES = 5;

export interface AnomalyVerdict {
  isAnomaly: boolean;
  ratio: number;
  severity: IncidentSeverity;
}

/**
 * A response is anomalous when its duration exceeds 2x the rolling baseline
 * average (per the spec). A minimum sample count guards against firing on a
 * nearly-empty baseline where the average is meaningless.
 */
export function evaluateAnomaly(
  durationMs: number,
  baselineAvgMs: number | null,
  baselineSamples: number,
): AnomalyVerdict {
  if (baselineAvgMs === null || baselineAvgMs <= 0 || baselineSamples < MIN_BASELINE_SAMPLES) {
    return { isAnomaly: false, ratio: 0, severity: 'warning' };
  }

  const ratio = durationMs / baselineAvgMs;
  return {
    isAnomaly: ratio > ANOMALY_THRESHOLD_RATIO,
    ratio,
    severity: ratio >= CRITICAL_THRESHOLD_RATIO ? 'critical' : 'warning',
  };
}
