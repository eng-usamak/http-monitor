import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../../config.js';

let client: Anthropic | null | undefined;

/** Returns a shared Anthropic client, or null when no API key is configured. */
export function getAnthropicClient(): Anthropic | null {
  if (client === undefined) {
    client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;
  }
  return client;
}
