import { Fragment, useState } from 'react';
import { useResponses } from '../hooks/useResponses';
import { formatBytes, formatDuration, formatTime } from '../lib/format';
import type { ResponseRecord } from '../lib/types';

function StatusBadge({ record }: { record: ResponseRecord }) {
  const label = record.statusCode === null ? 'ERR' : String(record.statusCode);
  const color = record.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

function DetailRow({ record }: { record: ResponseRecord }) {
  return (
    <tr className="bg-slate-50">
      <td colSpan={5} className="px-4 py-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Request payload</p>
            <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(record.requestPayload, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
              Response body {record.error ? `(${record.error})` : ''}
            </p>
            <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
              {typeof record.responseBody === 'string'
                ? record.responseBody
                : JSON.stringify(record.responseBody, null, 2)}
            </pre>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function ResponseTable() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isPending, isError, refetch, isPlaceholderData } = useResponses(page);

  if (isPending) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading responses…</p>;
  }

  if (isError) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-red-600">Failed to load responses.</p>
        <button
          onClick={() => void refetch()}
          className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No responses yet — the first check runs within 5 minutes.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className={isPlaceholderData ? 'opacity-60' : ''}>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
              <th className="hidden px-4 py-3 sm:table-cell">Size</th>
              <th className="hidden px-4 py-3 md:table-cell">Probe</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((record) => (
              <Fragment key={record.id}>
                <tr
                  onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3">{formatTime(record.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge record={record} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDuration(record.durationMs)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 sm:table-cell">
                    {formatBytes(record.responseSize)}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-slate-500 md:table-cell">
                    {String(record.requestPayload.probeId ?? '—')}
                  </td>
                </tr>
                {expandedId === record.id && <DetailRow record={record} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {data.page} of {totalPages} · {data.total} total
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
