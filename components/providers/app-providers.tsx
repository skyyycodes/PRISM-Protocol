'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';

import { Toaster } from '@/components/ui/sonner';
import { IdentityProvider } from '@/hooks/useIdentity';
import { SimulationActionProvider } from '@/hooks/useSimulationActions';
import { SimulationLogProvider } from '@/hooks/useSimulationLog';
import { LoanApplicationProvider } from '@/hooks/useLoanApplications';
import { SolanaWalletProvider } from './solana-wallet-provider';

// IKA contracts are deployed on Sui testnet. 
// We route through our proxy to handle rate-limiting and CORS.
const { networkConfig } = createNetworkConfig({
  testnet: { url: '/api/sui-proxy', network: 'testnet' as const },
});

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
        <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
          <WalletProvider autoConnect>
            <IdentityProvider>
              <SimulationLogProvider>
                <SimulationActionProvider>
                  <LoanApplicationProvider>{children}</LoanApplicationProvider>
                </SimulationActionProvider>
              </SimulationLogProvider>
            </IdentityProvider>
            <Toaster richColors position="bottom-right" />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </SolanaWalletProvider>
  );
}
