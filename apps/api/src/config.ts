import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/http-monitor',
  httpbinUrl: process.env.HTTPBIN_URL ?? 'https://httpbin.org/anything',
  pollCron: process.env.POLL_CRON ?? '*/5 * * * *',
  pollOnStart: process.env.POLL_ON_START !== 'false',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 10_000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  llmModel: process.env.LLM_MODEL ?? 'claude-haiku-4-5-20251001',
  llmMaxCallsPerHour: Number(process.env.LLM_MAX_CALLS_PER_HOUR ?? 20),
  // Anomaly tuning — overridable so an incident can be triggered on demand (e.g. demos).
  anomalyThresholdRatio: Number(process.env.ANOMALY_THRESHOLD_RATIO ?? 2),
  anomalyCriticalRatio: Number(process.env.ANOMALY_CRITICAL_RATIO ?? 3),
  anomalyMinSamples: Number(process.env.ANOMALY_MIN_SAMPLES ?? 5),
  incidentCooldownMinutes: Number(process.env.INCIDENT_COOLDOWN_MINUTES ?? 15),
};
