import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { analyzeRecentPayloads } from './analysis.service.js';
import { answerQuestion, chatLimiter, type ChatEmitter } from './chat.service.js';
import { IncidentModel } from './incidents/incident.model.js';
import { getUsageSummary } from './llm/costGuard.js';

const chatBodySchema = z.object({
  question: z.string().trim().min(1).max(500),
});

const incidentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function createInsightsRouter(): Router {
  const router = Router();

  router.post('/chat', (req: Request, res: Response) => {
    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'question must be a non-empty string (max 500 chars)' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const emit: ChatEmitter = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    answerQuestion(parsed.data.question, emit)
      .catch((error) => {
        logger.error({ err: error }, 'chat request failed');
        emit('error', { message: 'failed to answer question' });
      })
      .finally(() => res.end());
  });

  router.get('/incidents', async (req, res, next) => {
    try {
      const { page, limit } = incidentsQuerySchema.parse(req.query);
      const [docs, total] = await Promise.all([
        IncidentModel.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        IncidentModel.countDocuments(),
      ]);
      res.json({
        items: docs.map(({ _id, ...rest }) => ({ ...rest, id: String(_id) })),
        total,
        page,
        limit,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/llm/usage', async (_req, res, next) => {
    try {
      res.json(await getUsageSummary(chatLimiter, config.llmMaxCallsPerHour));
    } catch (error) {
      next(error);
    }
  });

  router.get('/insights/summary', async (req, res, next) => {
    try {
      const hours = z.coerce.number().min(1).max(168).default(24).parse(req.query.hours);
      res.json(await analyzeRecentPayloads(hours));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
