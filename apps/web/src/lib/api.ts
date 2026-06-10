import type { Paginated, ResponseRecord, Stats } from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchResponses(page: number, limit: number): Promise<Paginated<ResponseRecord>> {
  return getJson(`/api/responses?page=${page}&limit=${limit}`);
}

export function fetchStats(): Promise<Stats> {
  return getJson('/api/stats');
}
