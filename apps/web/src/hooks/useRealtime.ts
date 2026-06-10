import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSocket } from '../lib/socket';
import type { Paginated, ResponseRecord } from '../lib/types';
import { PAGE_SIZE } from './useResponses';

/**
 * Single app-level socket subscription. New records are merged into the
 * first-page cache directly (no refetch storm); stats and other pages are
 * invalidated so they refresh on demand.
 */
export function useRealtime(): { connected: boolean } {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = createSocket();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('response:new', (record: ResponseRecord) => {
      queryClient.setQueryData<Paginated<ResponseRecord>>(
        ['responses', 1, PAGE_SIZE],
        (prev) =>
          prev && {
            ...prev,
            total: prev.total + 1,
            items: [record, ...prev.items].slice(0, prev.limit),
          },
      );
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({
        queryKey: ['responses'],
        predicate: (query) => query.queryKey[1] !== 1,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return { connected };
}
