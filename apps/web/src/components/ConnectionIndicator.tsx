export function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span
        className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
        aria-hidden
      />
      {connected ? 'Live' : 'Disconnected'}
    </span>
  );
}
