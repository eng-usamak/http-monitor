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
