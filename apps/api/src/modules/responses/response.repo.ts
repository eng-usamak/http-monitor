import { ResponseModel } from './response.model.js';
import type {
  ListResponsesQuery,
  NewResponseRecord,
  ResponseRecord,
  ResponseStats,
} from './response.types.js';

interface ResponseDoc extends NewResponseRecord {
  _id: { toString(): string };
  createdAt: Date;
}

function toRecord(doc: ResponseDoc): ResponseRecord {
  return {
    id: doc._id.toString(),
    requestPayload: doc.requestPayload,
    statusCode: doc.statusCode,
    ok: doc.ok,
    durationMs: doc.durationMs,
    responseBody: doc.responseBody,
    responseSize: doc.responseSize,
    error: doc.error,
    createdAt: doc.createdAt,
  };
}

function timeFilter(from?: Date, to?: Date) {
  const createdAt: Record<string, Date> = {};
  if (from) createdAt.$gte = from;
  if (to) createdAt.$lte = to;
  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

export async function insertResponse(record: NewResponseRecord): Promise<ResponseRecord> {
  const doc = await ResponseModel.create(record);
  return toRecord(doc.toObject() as ResponseDoc);
}

export async function listResponses(
  query: ListResponsesQuery,
): Promise<{ items: ResponseRecord[]; total: number; page: number; limit: number }> {
  const filter = {
    ...timeFilter(query.from, query.to),
    ...(query.status ? { ok: query.status === 'ok' } : {}),
  };

  const [docs, total] = await Promise.all([
    ResponseModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<ResponseDoc[]>(),
    ResponseModel.countDocuments(filter),
  ]);

  return { items: docs.map(toRecord), total, page: query.page, limit: query.limit };
}

export async function getResponseById(id: string): Promise<ResponseRecord | null> {
  const doc = await ResponseModel.findById(id).lean<ResponseDoc>();
  return doc ? toRecord(doc) : null;
}

export async function getStats(from?: Date, to?: Date): Promise<ResponseStats> {
  const match = timeFilter(from, to);

  const [result] = await ResponseModel.aggregate<{
    count: number;
    okCount: number;
    avgDurationMs: number | null;
    p95DurationMs: number[] | null;
  }>([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        okCount: { $sum: { $cond: ['$ok', 1, 0] } },
        avgDurationMs: { $avg: '$durationMs' },
        p95DurationMs: {
          $percentile: { input: '$durationMs', p: [0.95], method: 'approximate' },
        },
      },
    },
  ]);

  if (!result) {
    return {
      count: 0,
      okCount: 0,
      errorCount: 0,
      errorRate: 0,
      avgDurationMs: null,
      p95DurationMs: null,
    };
  }

  const errorCount = result.count - result.okCount;
  return {
    count: result.count,
    okCount: result.okCount,
    errorCount,
    errorRate: result.count > 0 ? errorCount / result.count : 0,
    avgDurationMs: result.avgDurationMs,
    p95DurationMs: result.p95DurationMs?.[0] ?? null,
  };
}
