import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';
import { getResponseById, getStats, listResponses } from './response.repo.js';

const listQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['ok', 'error']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const statsQuerySchema = listQuerySchema.pick({ from: true, to: true });

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

export function createResponseRouter(): Router {
  const router = Router();

  router.get(
    '/responses',
    asyncHandler(async (req, res) => {
      const query = listQuerySchema.parse(req.query);
      res.json(await listResponses(query));
    }),
  );

  router.get(
    '/responses/:id',
    asyncHandler(async (req, res) => {
      const record = await getResponseById(req.params.id);
      if (!record) {
        res.status(404).json({ error: 'response not found' });
        return;
      }
      res.json(record);
    }),
  );

  router.get(
    '/stats',
    asyncHandler(async (req, res) => {
      const { from, to } = statsQuerySchema.parse(req.query);
      res.json(await getStats(from, to));
    }),
  );

  return router;
}
