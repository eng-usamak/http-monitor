import { useState } from 'react';
import { useIncidents, usePayloadSummary } from '../hooks/useInsights';
import { formatDuration, formatTime } from '../lib/format';
import type { Incident } from '../lib/types';

function SeverityBadge({ severity }: { severity: Incident['severity'] }) {
  const color = severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${color}`}>
      {severity}
    </span>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <span className="text-sm text-slate-500">{formatTime(incident.createdAt)}</span>
        {incident.llmGenerated && (
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
            AI analysis
          </span>
        )}
      </div>

      <p className="mt-2 font-medium text-slate-900">{incident.summary}</p>
      <p className="mt-1 text-sm text-slate-500">
        {formatDuration(incident.durationMs)} vs baseline {formatDuration(incident.baselineAvgMs)} (
        {incident.ratio.toFixed(1)}x) · {incident.endpoint}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Potential root causes</p>
          <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
            {incident.rootCauses.map((cause) => (
              <li key={cause}>{cause}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Recommendations</p>
          <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
            {incident.recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function IncidentsTab() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch } = useIncidents(page);
  const summary = usePayloadSummary();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">
          Response analysis {summary.data?.llmGenerated ? '(AI)' : ''}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {summary.isPending
            ? 'Analyzing recent responses…'
            : summary.isError
              ? 'Analysis unavailable.'
              : summary.data.summary}
        </p>
      </div>

      {isPending && <p className="py-8 text-center text-sm text-slate-500">Loading incidents…</p>}

      {isError && (
        <div className="py-8 text-center">
          <p className="text-sm text-red-600">Failed to load incidents.</p>
          <button
            onClick={() => void refetch()}
            className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No incidents — response times are within normal range.
        </p>
      )}

      {data?.items.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} />
      ))}

      {data && data.total > data.limit && (
        <div className="flex justify-end gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={page >= Math.ceil(data.total / data.limit)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
