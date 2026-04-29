'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { IdentityProvider } from '@/hooks/useIdentity';
import { SimulationActionProvider } from '@/hooks/useSimulationActions';
import { SimulationLogProvider } from '@/hooks/useSimulationLog';

import { SolanaWalletProvider } from './solana-wallet-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <SolanaWalletProvider>
      <QueryClientProvider client={queryClient}>
        <IdentityProvider>
          <SimulationLogProvider>
            <SimulationActionProvider>{children}</SimulationActionProvider>
          </SimulationLogProvider>
        </IdentityProvider>
        <Toaster richColors position="bottom-right" />
      </QueryClientProvider>
    </SolanaWalletProvider>
  );
}
