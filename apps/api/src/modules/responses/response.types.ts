export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface NewResponseRecord {
  requestPayload: JsonObject;
  statusCode: number | null;
  ok: boolean;
  durationMs: number;
  responseBody: JsonValue | null;
  responseSize: number;
  error: string | null;
}

export interface ResponseRecord extends NewResponseRecord {
  id: string;
  createdAt: Date;
}

export interface ListResponsesQuery {
  from?: Date;
  to?: Date;
  status?: 'ok' | 'error';
  page: number;
  limit: number;
}

export interface ResponseStats {
  count: number;
  okCount: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
}
