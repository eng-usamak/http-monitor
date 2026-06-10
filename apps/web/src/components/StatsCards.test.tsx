import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { StatsCards } from './StatsCards';

const { fetchStats } = vi.hoisted(() => ({ fetchStats: vi.fn() }));
vi.mock('../lib/api', () => ({ fetchStats }));

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('StatsCards', () => {
  it('renders stats after loading', async () => {
    fetchStats.mockResolvedValue({
      count: 12,
      okCount: 9,
      errorCount: 3,
      errorRate: 0.25,
      avgDurationMs: 850,
      p95DurationMs: 2100,
    });

    renderWithQuery(<StatsCards />);

    expect(screen.getByText('Loading stats…')).toBeDefined();
    expect(await screen.findByText('12')).toBeDefined();
    expect(screen.getByText('25.0%')).toBeDefined();
    expect(screen.getByText('850 ms')).toBeDefined();
    expect(screen.getByText('2.10 s')).toBeDefined();
  });

  it('renders an error state when the request fails', async () => {
    fetchStats.mockRejectedValue(new Error('boom'));

    renderWithQuery(<StatsCards />);

    expect(await screen.findByText('Failed to load stats.')).toBeDefined();
  });
});
