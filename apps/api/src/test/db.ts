import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let server: MongoMemoryServer | null = null;

export async function startTestDb(): Promise<void> {
  // $percentile in the stats aggregation requires MongoDB >= 7.0.
  server = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
    instance: { launchTimeout: 60_000 },
  });
  await mongoose.connect(server.getUri());
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await server?.stop();
  server = null;
}

export async function clearTestDb(): Promise<void> {
  const { db } = mongoose.connection;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
