import type { IncidentSeverity } from './incident.types.js';

export const ANOMALY_THRESHOLD_RATIO = 2;
export const CRITICAL_THRESHOLD_RATIO = 3;
export const MIN_BASELINE_SAMPLES = 5;

export interface AnomalyThresholds {
  anomalyRatio: number;
  criticalRatio: number;
  minSamples: number;
}

export const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  anomalyRatio: ANOMALY_THRESHOLD_RATIO,
  criticalRatio: CRITICAL_THRESHOLD_RATIO,
  minSamples: MIN_BASELINE_SAMPLES,
};

export interface AnomalyVerdict {
  isAnomaly: boolean;
  ratio: number;
  severity: IncidentSeverity;
}

/**
 * A response is anomalous when its duration exceeds the configured ratio (default
 * 2x) of the rolling baseline average. A minimum sample count guards against firing
 * on a nearly-empty baseline where the average is meaningless. Thresholds are
 * injectable so they can be tuned via config (e.g. lowered to trigger a demo).
 */
export function evaluateAnomaly(
  durationMs: number,
  baselineAvgMs: number | null,
  baselineSamples: number,
  thresholds: AnomalyThresholds = DEFAULT_THRESHOLDS,
): AnomalyVerdict {
  if (baselineAvgMs === null || baselineAvgMs <= 0 || baselineSamples < thresholds.minSamples) {
    return { isAnomaly: false, ratio: 0, severity: 'warning' };
  }

  const ratio = durationMs / baselineAvgMs;
  return {
    isAnomaly: ratio > thresholds.anomalyRatio,
    ratio,
    severity: ratio >= thresholds.criticalRatio ? 'critical' : 'warning',
  };
}
