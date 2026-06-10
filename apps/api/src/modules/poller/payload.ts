import type { JsonObject, JsonValue } from '../responses/response.types.js';

const WORDS = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'monitor',
  'latency',
  'probe',
  'signal',
  'beacon',
  'pulse',
  'trace',
  'metric',
];

type Rng = () => number;

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function randomInt(max: number, rng: Rng): number {
  return Math.floor(rng() * max);
}

function randomString(rng: Rng): string {
  return `${pick(WORDS, rng)}-${randomInt(10_000, rng)}`;
}

function randomValue(depth: number, rng: Rng): JsonValue {
  const generators: Array<() => JsonValue> = [
    () => randomString(rng),
    () => randomInt(100_000, rng),
    () => rng() < 0.5,
    () => null,
    () => Array.from({ length: randomInt(5, rng) + 1 }, () => randomString(rng)),
  ];

  // Nest objects only while depth budget remains, so payload size stays bounded.
  if (depth > 0) {
    generators.push(() => randomObject(depth - 1, rng));
  }

  return pick(generators, rng)();
}

function randomObject(depth: number, rng: Rng): JsonObject {
  const fieldCount = randomInt(5, rng) + 2;
  const obj: JsonObject = {};
  for (let i = 0; i < fieldCount; i += 1) {
    obj[`${pick(WORDS, rng)}_${i}`] = randomValue(depth, rng);
  }
  return obj;
}

/**
 * Generates a random JSON payload with varied shape: mixed primitive types,
 * arrays, and nested objects up to 2 levels deep. Accepts an injectable RNG
 * so tests can make generation deterministic.
 */
export function generatePayload(rng: Rng = Math.random): JsonObject {
  return {
    probeId: randomString(rng),
    sentAt: new Date().toISOString(),
    data: randomObject(2, rng),
  };
}
