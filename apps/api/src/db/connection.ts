import mongoose from 'mongoose';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export async function connectDb(url: string = config.mongoUrl): Promise<void> {
  await mongoose.connect(url);
  logger.info({ url: url.replace(/\/\/.*@/, '//***@') }, 'connected to MongoDB');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
