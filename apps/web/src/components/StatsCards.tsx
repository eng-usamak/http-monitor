import { useStats } from '../hooks/useResponses';
import { formatDuration } from '../lib/format';

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function StatsCards() {
  const { data, isPending, isError } = useStats();

  if (isPending) {
    return <p className="text-sm text-slate-500">Loading stats…</p>;
  }
  if (isError) {
    return <p className="text-sm text-red-600">Failed to load stats.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="Total checks" value={String(data.count)} />
      <Card label="Error rate" value={`${(data.errorRate * 100).toFixed(1)}%`} />
      <Card
        label="Avg response"
        value={data.avgDurationMs === null ? '—' : formatDuration(data.avgDurationMs)}
      />
      <Card
        label="p95 response"
        value={data.p95DurationMs === null ? '—' : formatDuration(data.p95DurationMs)}
      />
    </div>
  );
}
