import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://localhost:27017/http-monitor',
  httpbinUrl: process.env.HTTPBIN_URL ?? 'https://httpbin.org/anything',
  pollCron: process.env.POLL_CRON ?? '*/5 * * * *',
  pollOnStart: process.env.POLL_ON_START !== 'false',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 10_000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
