import { useQuery } from '@tanstack/react-query';
import { fetchIncidents, fetchSummary, fetchUsage } from '../lib/api';

export function useIncidents(page: number) {
  return useQuery({
    queryKey: ['incidents', page],
    queryFn: () => fetchIncidents(page, 20),
  });
}

export function useLlmUsage() {
  return useQuery({
    queryKey: ['llmUsage'],
    queryFn: fetchUsage,
    refetchInterval: 60_000,
  });
}

export function usePayloadSummary() {
  return useQuery({
    queryKey: ['payloadSummary'],
    queryFn: fetchSummary,
    staleTime: 5 * 60_000,
  });
}
