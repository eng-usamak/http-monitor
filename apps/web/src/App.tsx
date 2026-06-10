import { ConnectionIndicator } from './components/ConnectionIndicator';
import { ResponseTable } from './components/ResponseTable';
import { StatsCards } from './components/StatsCards';
import { useRealtime } from './hooks/useRealtime';

export function App() {
  const { connected } = useRealtime();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">HTTP Monitor</h1>
          <ConnectionIndicator connected={connected} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <StatsCards />
        <ResponseTable />
      </main>
    </div>
  );
}
