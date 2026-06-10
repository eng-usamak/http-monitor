import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/db.js';
import { ResponseModel } from './response.model.js';

async function seed(records: Array<{ durationMs: number; ok: boolean; createdAt: Date }>) {
  await ResponseModel.insertMany(
    records.map((r, i) => ({
      requestPayload: { probeId: `seed-${i}` },
      statusCode: r.ok ? 200 : 503,
      ok: r.ok,
      durationMs: r.durationMs,
      responseBody: null,
      responseSize: 0,
      error: r.ok ? null : 'HTTP 503',
      createdAt: r.createdAt,
    })),
  );
}

const T0 = new Date('2026-01-01T00:00:00Z');
const T1 = new Date('2026-01-01T01:00:00Z');
const T2 = new Date('2026-01-01T02:00:00Z');

describe('response API', () => {
  const app = createApp();

  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  describe('GET /api/responses', () => {
    it('returns newest-first with pagination metadata', async () => {
      await seed([
        { durationMs: 100, ok: true, createdAt: T0 },
        { durationMs: 200, ok: true, createdAt: T1 },
        { durationMs: 300, ok: true, createdAt: T2 },
      ]);

      const res = await request(app).get('/api/responses?limit=2');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].durationMs).toBe(300);
      expect(res.body.items[1].durationMs).toBe(200);
    });

    it('filters by status and time range', async () => {
      await seed([
        { durationMs: 100, ok: true, createdAt: T0 },
        { durationMs: 200, ok: false, createdAt: T1 },
        { durationMs: 300, ok: true, createdAt: T2 },
      ]);

      const errors = await request(app).get('/api/responses?status=error');
      expect(errors.body.total).toBe(1);
      expect(errors.body.items[0].error).toBe('HTTP 503');

      const windowed = await request(app).get(
        `/api/responses?from=${T1.toISOString()}&to=${T1.toISOString()}`,
      );
      expect(windowed.body.total).toBe(1);
      expect(windowed.body.items[0].durationMs).toBe(200);
    });

    it('rejects invalid query parameters with 400', async () => {
      const badStatus = await request(app).get('/api/responses?status=weird');
      expect(badStatus.status).toBe(400);
      expect(badStatus.body.error).toBe('invalid query parameters');

      const badLimit = await request(app).get('/api/responses?limit=999');
      expect(badLimit.status).toBe(400);
    });
  });

  describe('GET /api/responses/:id', () => {
    it('returns a single record, 404 for missing, 400 for malformed id', async () => {
      await seed([{ durationMs: 100, ok: true, createdAt: T0 }]);
      const list = await request(app).get('/api/responses');
      const id = list.body.items[0].id;

      const found = await request(app).get(`/api/responses/${id}`);
      expect(found.status).toBe(200);
      expect(found.body.id).toBe(id);

      const missing = await request(app).get('/api/responses/64b000000000000000000000');
      expect(missing.status).toBe(404);

      const malformed = await request(app).get('/api/responses/not-an-id');
      expect(malformed.status).toBe(400);
    });
  });

  describe('GET /api/stats', () => {
    it('returns zeroed stats for an empty collection', async () => {
      const res = await request(app).get('/api/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        count: 0,
        okCount: 0,
        errorCount: 0,
        errorRate: 0,
        avgDurationMs: null,
        p95DurationMs: null,
      });
    });

    it('computes count, error rate, average, and p95', async () => {
      await seed([
        { durationMs: 100, ok: true, createdAt: T0 },
        { durationMs: 200, ok: true, createdAt: T1 },
        { durationMs: 300, ok: true, createdAt: T2 },
        { durationMs: 400, ok: false, createdAt: T2 },
      ]);

      const res = await request(app).get('/api/stats');

      expect(res.body.count).toBe(4);
      expect(res.body.errorCount).toBe(1);
      expect(res.body.errorRate).toBe(0.25);
      expect(res.body.avgDurationMs).toBe(250);
      expect(res.body.p95DurationMs).toBeGreaterThanOrEqual(300);
      expect(res.body.p95DurationMs).toBeLessThanOrEqual(400);
    });
  });
});
