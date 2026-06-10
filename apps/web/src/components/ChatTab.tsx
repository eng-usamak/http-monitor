import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLlmUsage } from '../hooks/useInsights';
import { streamChat } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  fallback?: boolean;
  cached?: boolean;
}

const SUGGESTIONS = [
  'What were the slowest response times today?',
  'Summarize any issues in the last 24 hours',
  'What is the current error rate?',
];

function CostPanel() {
  const { data } = useLlmUsage();
  if (!data) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
      <span>
        LLM calls left this hour:{' '}
        <strong>
          {data.callsRemainingThisHour}/{data.maxCallsPerHour}
        </strong>
      </span>
      <span>
        Tokens: {data.totalTokensIn.toLocaleString()} in / {data.totalTokensOut.toLocaleString()}{' '}
        out
      </span>
      <span>
        Est. total cost: <strong>${data.totalCostUsd.toFixed(4)}</strong>
      </span>
    </div>
  );
}

export function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setInput('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: question },
      { role: 'assistant', text: '' },
    ]);

    const appendToLast = (text: string) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          text: next[next.length - 1].text + text,
        };
        return next;
      });

    try {
      await streamChat(question, {
        onToken: appendToLast,
        onDone: (meta) =>
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], ...meta };
            return next;
          }),
        onError: (message) => appendToLast(`\n[error: ${message}]`),
      });
    } catch {
      appendToLast('\n[error: connection failed]');
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ['llmUsage'] });
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="space-y-3">
      <CostPanel />

      <div className="flex h-[28rem] flex-col rounded-lg border border-slate-200 bg-white">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-2 text-sm text-slate-500">
              <p>Ask anything about the monitoring data. Try:</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="block rounded border border-slate-200 px-3 py-1.5 text-left hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((message, i) => (
            <div key={i} className={message.role === 'user' ? 'text-right' : ''}>
              <div
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm ${
                  message.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {message.text || '…'}
              </div>
              {message.role === 'assistant' && (message.fallback || message.cached) && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {message.cached ? 'cached answer' : 'quota-saving fallback (no LLM call)'}
                </p>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex gap-2 border-t border-slate-200 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the monitoring data…"
            maxLength={500}
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {busy ? 'Thinking…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
