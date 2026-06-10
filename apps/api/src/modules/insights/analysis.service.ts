import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { ResponseModel } from '../responses/response.model.js';
import { getAnthropicClient } from './llm/client.js';
import { recordUsage, TtlCache } from './llm/costGuard.js';
import { chatLimiter } from './chat.service.js';

const summaryCache = new TtlCache<PayloadAnalysis>(30 * 60 * 1000);

export interface PayloadAnalysis {
  summary: string;
  llmGenerated: boolean;
  basedOnResponses: number;
  generatedAt: string;
}

interface Aggregates {
  count: number;
  statusCodes: Record<string, number>;
  avgSize: number;
  bodyTypes: Record<string, number>;
  avgDurationMs: number;
}

async function collectAggregates(hours: number): Promise<Aggregates> {
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const docs = await ResponseModel.find(
    { createdAt: { $gte: from } },
    { statusCode: 1, responseSize: 1, responseBody: 1, durationMs: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean<
      Array<{
        statusCode: number | null;
        responseSize: number;
        responseBody: unknown;
        durationMs: number;
      }>
    >();

  const statusCodes: Record<string, number> = {};
  const bodyTypes: Record<string, number> = {};
  let sizeSum = 0;
  let durationSum = 0;

  for (const doc of docs) {
    const code = doc.statusCode === null ? 'network-error' : String(doc.statusCode);
    statusCodes[code] = (statusCodes[code] ?? 0) + 1;
    const type =
      doc.responseBody === null ? 'empty' : typeof doc.responseBody === 'string' ? 'text' : 'json';
    bodyTypes[type] = (bodyTypes[type] ?? 0) + 1;
    sizeSum += doc.responseSize;
    durationSum += doc.durationMs;
  }

  return {
    count: docs.length,
    statusCodes,
    bodyTypes,
    avgSize: docs.length ? Math.round(sizeSum / docs.length) : 0,
    avgDurationMs: docs.length ? Math.round(durationSum / docs.length) : 0,
  };
}

function ruleBasedSummary(agg: Aggregates): string {
  const codeList = Object.entries(agg.statusCodes)
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${code} (${n})`)
    .join(', ');
  const typeList = Object.entries(agg.bodyTypes)
    .map(([t, n]) => `${t}: ${n}`)
    .join(', ');
  return (
    `Analyzed ${agg.count} responses. Status distribution: ${codeList || 'none'}. ` +
    `Body types — ${typeList || 'none'}. Average body size ${agg.avgSize} bytes, ` +
    `average response time ${agg.avgDurationMs} ms.`
  );
}

export async function analyzeRecentPayloads(hours = 24): Promise<PayloadAnalysis> {
  const key = `summary:${hours}`;
  const cached = summaryCache.get(key);
  if (cached) return cached;

  const agg = await collectAggregates(hours);
  const client = getAnthropicClient();

  let result: PayloadAnalysis;

  if (agg.count === 0) {
    result = {
      summary: 'No responses recorded in this window yet.',
      llmGenerated: false,
      basedOnResponses: 0,
      generatedAt: new Date().toISOString(),
    };
  } else if (client && chatLimiter.tryAcquire(1)) {
    try {
      const message = await client.messages.create({
        model: config.llmModel,
        max_tokens: 300,
        system:
          'You analyze HTTP monitoring data. Write a concise 2-4 sentence natural-language ' +
          'summary of the aggregates you are given: notable patterns, error clusters, anything unusual. ' +
          'Plain prose, no markdown.',
        messages: [{ role: 'user', content: JSON.stringify(agg) }],
      });
      await recordUsage('analysis', message.usage.input_tokens, message.usage.output_tokens);
      const text = message.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      result = {
        summary: text || ruleBasedSummary(agg),
        llmGenerated: Boolean(text),
        basedOnResponses: agg.count,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn({ err: error }, 'LLM payload analysis failed, using rule-based summary');
      result = {
        summary: ruleBasedSummary(agg),
        llmGenerated: false,
        basedOnResponses: agg.count,
        generatedAt: new Date().toISOString(),
      };
    }
  } else {
    result = {
      summary: ruleBasedSummary(agg),
      llmGenerated: false,
      basedOnResponses: agg.count,
      generatedAt: new Date().toISOString(),
    };
  }

  summaryCache.set(key, result);
  return result;
}
