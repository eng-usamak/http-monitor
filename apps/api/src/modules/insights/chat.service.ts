import type Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { getStats } from '../responses/response.repo.js';
import { getAnthropicClient } from './llm/client.js';
import {
  estimateTokens,
  MAX_ESTIMATED_INPUT_TOKENS,
  normalizeQuestion,
  recordUsage,
  SlidingWindowLimiter,
  TtlCache,
} from './llm/costGuard.js';
import { executeTool, toolDefinitions } from './queryTools.js';

export const chatLimiter = new SlidingWindowLimiter(config.llmMaxCallsPerHour);
const answerCache = new TtlCache<string>(15 * 60 * 1000);

const SYSTEM_PROMPT = `You are a monitoring assistant for an HTTP uptime dashboard.
The system pings httpbin.org/anything every 5 minutes and records status, latency, and payloads.
Use the provided tools to query monitoring data, then answer concisely in plain language.
Times in tool results are UTC ISO strings; durations are milliseconds.
If the data cannot answer the question, say so. Never invent numbers.`;

export interface ChatEmitter {
  (event: 'token', data: string): void;
  (event: 'done', data: { cached: boolean; fallback: boolean }): void;
  (event: 'error', data: { message: string }): void;
}

/**
 * Quota-free fallback: keyword intent detection over the same query
 * templates, formatted without an LLM. Quality degrades, availability doesn't.
 */
async function fallbackAnswer(question: string): Promise<string> {
  const q = question.toLowerCase();

  if (q.includes('slow')) {
    const rows = (await executeTool('get_slowest_responses', {})) as Array<{
      durationMs: number;
      statusCode: number | null;
      createdAt: Date;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) return 'No responses recorded yet.';
    const lines = rows.map(
      (r, i) =>
        `${i + 1}. ${Math.round(r.durationMs)} ms (status ${r.statusCode ?? 'ERR'}) at ${new Date(r.createdAt).toISOString()}`,
    );
    return `Slowest responses in the last 24 hours:\n${lines.join('\n')}`;
  }

  if (q.includes('error') || q.includes('issue') || q.includes('fail') || q.includes('incident')) {
    const summary = (await executeTool('get_error_summary', {})) as {
      totalChecks: number;
      errorCount: number;
    };
    return `In the last 24 hours: ${summary.totalChecks} checks, ${summary.errorCount} failed.`;
  }

  const stats = await getStats(new Date(Date.now() - 24 * 60 * 60 * 1000));
  return (
    `Last 24 hours: ${stats.count} checks, error rate ${(stats.errorRate * 100).toFixed(1)}%, ` +
    `average response ${stats.avgDurationMs === null ? 'n/a' : `${Math.round(stats.avgDurationMs)} ms`}, ` +
    `p95 ${stats.p95DurationMs === null ? 'n/a' : `${Math.round(stats.p95DurationMs)} ms`}.`
  );
}

async function serveFallback(question: string, emit: ChatEmitter): Promise<void> {
  const text = await fallbackAnswer(question);
  emit('token', text);
  emit('done', { cached: false, fallback: true });
}

export async function answerQuestion(question: string, emit: ChatEmitter): Promise<void> {
  const key = normalizeQuestion(question);

  const cached = answerCache.get(key);
  if (cached !== undefined) {
    emit('token', cached);
    emit('done', { cached: true, fallback: false });
    return;
  }

  const client = getAnthropicClient();
  const estimated = estimateTokens(SYSTEM_PROMPT + question);

  // A question costs up to 2 API calls (tool selection + final answer);
  // reserve both up front so we never start what we cannot finish.
  const allowed =
    client !== null && estimated <= MAX_ESTIMATED_INPUT_TOKENS && chatLimiter.tryAcquire(2);

  if (!allowed || client === null) {
    await serveFallback(question, emit);
    return;
  }

  try {
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }];

    const first = await client.messages.create({
      model: config.llmModel,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });
    await recordUsage('chat', first.usage.input_tokens, first.usage.output_tokens);

    if (first.stop_reason !== 'tool_use') {
      const text = first.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      answerCache.set(key, text);
      emit('token', text);
      emit('done', { cached: false, fallback: false });
      return;
    }

    const toolUses = first.content.filter((b) => b.type === 'tool_use');
    const results = await Promise.all(
      toolUses.map(async (block) => ({
        type: 'tool_result' as const,
        tool_use_id: block.id,
        content: JSON.stringify(await executeTool(block.name, block.input)),
      })),
    );
    messages.push({ role: 'assistant', content: first.content });
    messages.push({ role: 'user', content: results });

    let full = '';
    const stream = client.messages.stream({
      model: config.llmModel,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });
    stream.on('text', (text) => {
      full += text;
      emit('token', text);
    });
    const final = await stream.finalMessage();
    await recordUsage('chat', final.usage.input_tokens, final.usage.output_tokens);

    answerCache.set(key, full);
    emit('done', { cached: false, fallback: false });
  } catch (error) {
    logger.error({ err: error }, 'LLM chat failed, serving fallback');
    await serveFallback(question, emit);
  }
}
