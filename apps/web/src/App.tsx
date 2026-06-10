import { useState } from 'react';
import { ChatTab } from './components/ChatTab';
import { ConnectionIndicator } from './components/ConnectionIndicator';
import { IncidentsTab } from './components/IncidentsTab';
import { ResponseTable } from './components/ResponseTable';
import { StatsCards } from './components/StatsCards';
import { useRealtime } from './hooks/useRealtime';

type Tab = 'dashboard' | 'incidents' | 'chat';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'chat', label: 'Ask AI' },
];

export function App() {
  const { connected } = useRealtime();
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">HTTP Monitor</h1>
          <ConnectionIndicator connected={connected} />
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                tab === id
                  ? 'border border-b-0 border-slate-200 bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {tab === 'dashboard' && (
          <>
            <StatsCards />
            <ResponseTable />
          </>
        )}
        {tab === 'incidents' && <IncidentsTab />}
        {tab === 'chat' && <ChatTab />}
      </main>
    </div>
  );
}
