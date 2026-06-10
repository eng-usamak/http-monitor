import { emitResponseCreated } from '../../lib/events.js';
import { logger } from '../../lib/logger.js';
import { insertResponse } from '../responses/response.repo.js';
import type { NewResponseRecord, ResponseRecord } from '../responses/response.types.js';

/**
 * Persists a poll result and notifies listeners. Persist-then-emit ordering
 * guarantees a client refetching after the event always finds the record.
 */
export async function ingestResponse(record: NewResponseRecord): Promise<ResponseRecord> {
  const saved = await insertResponse(record);
  emitResponseCreated(saved);
  logger.info(
    { id: saved.id, statusCode: saved.statusCode, durationMs: Math.round(saved.durationMs) },
    'response ingested',
  );
  return saved;
}
