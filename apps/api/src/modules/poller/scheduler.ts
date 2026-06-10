import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { ingestResponse } from '../ingest/ingest.js';
import { pollOnce } from './poller.js';

async function runTick(): Promise<void> {
  try {
    const record = await pollOnce();
    await ingestResponse(record);
  } catch (error) {
    // A failed tick must never crash the process; the next tick still runs.
    logger.error({ err: error }, 'poll tick failed');
  }
}

export function startPoller(): ScheduledTask {
  const task = cron.schedule(config.pollCron, () => void runTick());
  logger.info({ cron: config.pollCron }, 'poller scheduled');

  if (config.pollOnStart) {
    void runTick();
  }

  return task;
}
