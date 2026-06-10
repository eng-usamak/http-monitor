import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb, disconnectDb } from './db/connection.js';
import { logger } from './lib/logger.js';
import { startAnomalyWatcher } from './modules/insights/incidents/incident.service.js';
import { startPoller } from './modules/poller/scheduler.js';
import { attachRealtime } from './modules/realtime/socket.js';

async function main(): Promise<void> {
  await connectDb();

  const app = createApp();
  const server = createServer(app);
  attachRealtime(server);
  startAnomalyWatcher();
  const poller = startPoller();

  server.listen(config.port, () => {
    logger.info({ port: config.port }, 'API listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    poller.stop();
    server.close(() => {
      void disconnectDb().then(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ err: error }, 'failed to start');
  process.exit(1);
});
