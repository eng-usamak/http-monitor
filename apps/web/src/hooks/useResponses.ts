import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchResponses, fetchStats } from '../lib/api';

export const PAGE_SIZE = 20;

export function useResponses(page: number) {
  return useQuery({
    queryKey: ['responses', page, PAGE_SIZE],
    queryFn: () => fetchResponses(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });
}
