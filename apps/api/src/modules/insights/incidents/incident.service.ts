import { config } from '../../../config.js';
import { emitIncidentCreated, onResponseCreated } from '../../../lib/events.js';
import { logger } from '../../../lib/logger.js';
import { ResponseModel } from '../../responses/response.model.js';
import type { ResponseRecord } from '../../responses/response.types.js';
import { getAnthropicClient } from '../llm/client.js';
import { recordUsage } from '../llm/costGuard.js';
import { chatLimiter } from '../chat.service.js';
import { evaluateAnomaly, type AnomalyVerdict } from './anomaly.js';
import { IncidentModel } from './incident.model.js';
import type { IncidentRecord } from './incident.types.js';

const BASELINE_WINDOW_MS = 60 * 60 * 1000; // rolling 1-hour baseline
const INCIDENT_COOLDOWN_MS = 15 * 60 * 1000; // suppress repeat incidents

interface Baseline {
  avg: number | null;
  count: number;
}

async function getBaseline(before: Date): Promise<Baseline> {
  const [row] = await ResponseModel.aggregate<{ avg: number; count: number }>([
    {
      $match: {
        createdAt: { $gte: new Date(before.getTime() - BASELINE_WINDOW_MS), $lt: before },
      },
    },
    { $group: { _id: null, avg: { $avg: '$durationMs' }, count: { $sum: 1 } } },
  ]);
  return { avg: row?.avg ?? null, count: row?.count ?? 0 };
}

async function inCooldown(): Promise<boolean> {
  const latest = await IncidentModel.findOne()
    .sort({ createdAt: -1 })
    .lean<{ createdAt: Date } | null>();
  return latest !== null && Date.now() - latest.createdAt.getTime() < INCIDENT_COOLDOWN_MS;
}

const FALLBACK_ROOT_CAUSES = [
  'Upstream service (httpbin.org) under load or degraded',
  'Network latency between the monitor and the upstream service',
  'Upstream rate limiting or queuing of requests',
];

const FALLBACK_RECOMMENDATIONS = [
  'Check whether subsequent checks return to baseline (transient spike)',
  'Compare against upstream status pages or known outages',
  'Review response bodies of slow checks for error hints',
];

interface Enrichment {
  rootCauses: string[];
  recommendations: string[];
  llmGenerated: boolean;
}

async function enrich(
  record: ResponseRecord,
  baselineAvg: number,
  verdict: AnomalyVerdict,
): Promise<Enrichment> {
  const client = getAnthropicClient();
  if (!client || !chatLimiter.tryAcquire(1)) {
    return {
      rootCauses: FALLBACK_ROOT_CAUSES,
      recommendations: FALLBACK_RECOMMENDATIONS,
      llmGenerated: false,
    };
  }

  try {
    const message = await client.messages.create({
      model: config.llmModel,
      max_tokens: 400,
      system:
        'You are an SRE assistant. Given an HTTP monitoring anomaly, reply ONLY with JSON: ' +
        '{"rootCauses": string[], "recommendations": string[]} — 2-4 short items each.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            endpoint: config.httpbinUrl,
            durationMs: Math.round(record.durationMs),
            baselineAvgMs: Math.round(baselineAvg),
            ratio: Number(verdict.ratio.toFixed(2)),
            statusCode: record.statusCode,
            error: record.error,
          }),
        },
      ],
    });
    await recordUsage('incident', message.usage.input_tokens, message.usage.output_tokens);

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = JSON.parse(text) as { rootCauses?: string[]; recommendations?: string[] };
    return {
      rootCauses: parsed.rootCauses ?? FALLBACK_ROOT_CAUSES,
      recommendations: parsed.recommendations ?? FALLBACK_RECOMMENDATIONS,
      llmGenerated: true,
    };
  } catch (error) {
    logger.warn({ err: error }, 'LLM incident enrichment failed, using fallback');
    return {
      rootCauses: FALLBACK_ROOT_CAUSES,
      recommendations: FALLBACK_RECOMMENDATIONS,
      llmGenerated: false,
    };
  }
}

export async function checkForIncident(record: ResponseRecord): Promise<IncidentRecord | null> {
  const baseline = await getBaseline(record.createdAt);
  const verdict = evaluateAnomaly(record.durationMs, baseline.avg, baseline.count);
  if (!verdict.isAnomaly) return null;
  if (await inCooldown()) return null;

  // The anomaly guard above guarantees a positive baseline average.
  const baselineAvg = baseline.avg as number;
  const enrichment = await enrich(record, baselineAvg, verdict);

  const doc = await IncidentModel.create({
    responseId: record.id,
    endpoint: config.httpbinUrl,
    severity: verdict.severity,
    durationMs: record.durationMs,
    baselineAvgMs: baselineAvg,
    ratio: verdict.ratio,
    summary:
      `Response time ${Math.round(record.durationMs)} ms is ` +
      `${verdict.ratio.toFixed(1)}x the 1-hour average of ${Math.round(baselineAvg)} ms`,
    ...enrichment,
  });

  // `createdAt` is added at runtime by the `timestamps` option but is not part
  // of the inferred document type, so widen the type before reading it.
  const created = doc as typeof doc & { createdAt: Date };

  const incident: IncidentRecord = {
    id: created._id.toString(),
    responseId: created.responseId,
    endpoint: created.endpoint,
    severity: created.severity as IncidentRecord['severity'],
    durationMs: created.durationMs,
    baselineAvgMs: created.baselineAvgMs,
    ratio: created.ratio,
    summary: created.summary,
    rootCauses: created.rootCauses,
    recommendations: created.recommendations,
    llmGenerated: created.llmGenerated,
    createdAt: created.createdAt,
  };

  emitIncidentCreated(incident);
  logger.warn(
    { incidentId: incident.id, severity: incident.severity, ratio: incident.ratio.toFixed(2) },
    'incident created',
  );
  return incident;
}

export function startAnomalyWatcher(): void {
  onResponseCreated((record) => {
    checkForIncident(record).catch((error) => {
      logger.error({ err: error }, 'anomaly check failed');
    });
  });
}
