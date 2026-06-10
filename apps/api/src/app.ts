import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { createInsightsRouter } from './modules/insights/insights.routes.js';
import { createResponseRouter } from './modules/responses/response.routes.js';

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', createResponseRouter());
  app.use('/api', createInsightsRouter());

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid query parameters', details: err.issues });
      return;
    }
    if (err instanceof Error && err.name === 'CastError') {
      res.status(400).json({ error: 'invalid id format' });
      return;
    }
    logger.error({ err }, 'unhandled request error');
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
