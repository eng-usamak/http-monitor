export interface ResponseRecord {
  id: string;
  requestPayload: Record<string, unknown>;
  statusCode: number | null;
  ok: boolean;
  durationMs: number;
  responseBody: unknown;
  responseSize: number;
  error: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Stats {
  count: number;
  okCount: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
}

export interface Incident {
  id: string;
  responseId: string;
  endpoint: string;
  severity: 'warning' | 'critical';
  durationMs: number;
  baselineAvgMs: number;
  ratio: number;
  summary: string;
  rootCauses: string[];
  recommendations: string[];
  llmGenerated: boolean;
  createdAt: string;
}

export interface UsageSummary {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  callsRemainingThisHour: number;
  maxCallsPerHour: number;
}

export interface PayloadAnalysis {
  summary: string;
  llmGenerated: boolean;
  basedOnResponses: number;
  generatedAt: string;
}

export interface ChatDone {
  cached: boolean;
  fallback: boolean;
}
