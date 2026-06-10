import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ResponseModel } from '../responses/response.model.js';
import { getStats } from '../responses/response.repo.js';

/**
 * The LLM never writes database queries. It can only pick one of these
 * predefined, parameter-validated templates (tool use). This rules out
 * injection and hallucinated fields by construction.
 */

const hoursSchema = z.coerce.number().min(1).max(168).default(24);

const slowestParams = z.object({
  hours: hoursSchema,
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

const errorSummaryParams = z.object({ hours: hoursSchema });

const statsParams = z.object({ hours: hoursSchema });

const windowParams = z.object({
  isoTime: z.coerce.date(),
  windowMinutes: z.coerce.number().int().min(1).max(720).default(30),
});

function since(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

const PROJECTION = { statusCode: 1, ok: 1, durationMs: 1, error: 1, createdAt: 1 } as const;

async function getSlowestResponses(input: unknown) {
  const { hours, limit } = slowestParams.parse(input);
  return ResponseModel.find({ createdAt: { $gte: since(hours) } }, PROJECTION)
    .sort({ durationMs: -1 })
    .limit(limit)
    .lean();
}

async function getErrorSummary(input: unknown) {
  const { hours } = errorSummaryParams.parse(input);
  const from = since(hours);
  const [total, errors, recent] = await Promise.all([
    ResponseModel.countDocuments({ createdAt: { $gte: from } }),
    ResponseModel.countDocuments({ createdAt: { $gte: from }, ok: false }),
    ResponseModel.find({ createdAt: { $gte: from }, ok: false }, PROJECTION)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);
  return { totalChecks: total, errorCount: errors, recentErrors: recent };
}

async function getStatsTool(input: unknown) {
  const { hours } = statsParams.parse(input);
  return getStats(since(hours));
}

async function getResponsesAround(input: unknown) {
  const { isoTime, windowMinutes } = windowParams.parse(input);
  const half = (windowMinutes / 2) * 60 * 1000;
  return ResponseModel.find(
    {
      createdAt: {
        $gte: new Date(isoTime.getTime() - half),
        $lte: new Date(isoTime.getTime() + half),
      },
    },
    PROJECTION,
  )
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();
}

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'get_slowest_responses',
    description: 'Returns the N slowest monitored responses within the last X hours.',
    input_schema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Lookback window in hours (1-168, default 24)' },
        limit: { type: 'number', description: 'How many responses to return (1-20, default 5)' },
      },
    },
  },
  {
    name: 'get_error_summary',
    description:
      'Returns total checks, error count, and the most recent failed checks within the last X hours.',
    input_schema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Lookback window in hours (1-168, default 24)' },
      },
    },
  },
  {
    name: 'get_stats',
    description:
      'Returns aggregate stats (count, error rate, average and p95 response time in ms) for the last X hours.',
    input_schema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Lookback window in hours (1-168, default 24)' },
      },
    },
  },
  {
    name: 'get_responses_around',
    description:
      'Returns monitored responses in a time window centred on a specific moment. Useful for "why did X happen at 2pm" questions.',
    input_schema: {
      type: 'object',
      properties: {
        isoTime: { type: 'string', description: 'ISO 8601 timestamp at the centre of the window' },
        windowMinutes: {
          type: 'number',
          description: 'Total window size in minutes (1-720, default 30)',
        },
      },
      required: ['isoTime'],
    },
  },
];

const executors: Record<string, (input: unknown) => Promise<unknown>> = {
  get_slowest_responses: getSlowestResponses,
  get_error_summary: getErrorSummary,
  get_stats: getStatsTool,
  get_responses_around: getResponsesAround,
};

export async function executeTool(name: string, input: unknown): Promise<unknown> {
  const executor = executors[name];
  if (!executor) {
    return { error: `unknown tool: ${name}` };
  }
  try {
    return await executor(input);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'tool execution failed' };
  }
}
