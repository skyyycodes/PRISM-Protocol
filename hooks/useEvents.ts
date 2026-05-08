'use client';

import { useQuery } from '@tanstack/react-query';

import { PRISM_CORE_PROGRAM_ID } from '@/app/lib/constants';
import { fetchProtocolEvents, type ProtocolEvent } from '@/app/lib/dune-sim';

export function useEvents() {
  return useQuery<ProtocolEvent[]>({
    queryKey: ['dune-events', PRISM_CORE_PROGRAM_ID.toBase58()],
    queryFn: () => fetchProtocolEvents(PRISM_CORE_PROGRAM_ID.toBase58()),
    refetchInterval: 15_000,
    staleTime: 10_000,
    initialData: [],
  });
}
