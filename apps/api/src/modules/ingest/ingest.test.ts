import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { onResponseCreated } from '../../lib/events.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/db.js';
import { ResponseModel } from '../responses/response.model.js';
import type { NewResponseRecord, ResponseRecord } from '../responses/response.types.js';
import { ingestResponse } from './ingest.js';

const sample: NewResponseRecord = {
  requestPayload: { probeId: 'alpha-1' },
  statusCode: 200,
  ok: true,
  durationMs: 123.4,
  responseBody: { echoed: true },
  responseSize: 42,
  error: null,
};

describe('ingestResponse', () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('persists the record and returns it with id and createdAt', async () => {
    const saved = await ingestResponse(sample);

    expect(saved.id).toBeTruthy();
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.durationMs).toBe(123.4);

    const inDb = await ResponseModel.findById(saved.id);
    expect(inDb).not.toBeNull();
    expect(inDb?.statusCode).toBe(200);
  });

  it('emits response.created only after the record is queryable', async () => {
    const events: Array<{ record: ResponseRecord; wasPersisted: boolean }> = [];
    const checks: Promise<void>[] = [];

    onResponseCreated((record) => {
      checks.push(
        ResponseModel.findById(record.id).then((doc) => {
          events.push({ record, wasPersisted: doc !== null });
        }),
      );
    });

    const saved = await ingestResponse(sample);
    await Promise.all(checks);

    expect(events).toHaveLength(1);
    expect(events[0].record.id).toBe(saved.id);
    expect(events[0].wasPersisted).toBe(true);
  });
});
