import type {
  ChatDone,
  Incident,
  Paginated,
  PayloadAnalysis,
  ResponseRecord,
  Stats,
  UsageSummary,
} from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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

export function fetchIncidents(page: number, limit: number): Promise<Paginated<Incident>> {
  return getJson(`/api/incidents?page=${page}&limit=${limit}`);
}

export function fetchUsage(): Promise<UsageSummary> {
  return getJson('/api/llm/usage');
}

export function fetchSummary(): Promise<PayloadAnalysis> {
  return getJson('/api/insights/summary');
}

export interface ChatStreamHandlers {
  onToken: (text: string) => void;
  onDone: (meta: ChatDone) => void;
  onError: (message: string) => void;
}

/** POSTs a question and consumes the SSE response stream. */
export async function streamChat(question: string, handlers: ChatStreamHandlers): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  if (!res.ok || !res.body) {
    handlers.onError(`request failed with status ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const eventMatch = frame.match(/^event: (.+)$/m);
      const dataMatch = frame.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;

      const data = JSON.parse(dataMatch[1]);
      if (eventMatch[1] === 'token') handlers.onToken(data as string);
      else if (eventMatch[1] === 'done') handlers.onDone(data as ChatDone);
      else if (eventMatch[1] === 'error') handlers.onError((data as { message: string }).message);
    }
  }
}
