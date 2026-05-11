"use client";

import { useMemo, type ReactNode } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
  TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

const NETWORK = WalletAdapterNetwork.Devnet;

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(
    () =>
      process.env.NEXT_PUBLIC_RPC_ENDPOINT ??
      process.env.NEXT_PUBLIC_RPC_URL ??
      clusterApiUrl(NETWORK),
    [],
  );

  // Explicit adapters for wallets that don't yet implement the Wallet Standard.
  // Standard-compliant wallets (Phantom, Backpack, Solflare on modern versions)
  // are also auto-detected by the adapter layer.
  // Phantom and Solflare implement the Wallet Standard and are auto-detected.
  // Only list adapters for wallets that need the legacy adapter path.
  const wallets = useMemo(
    () => [
      new CoinbaseWalletAdapter(),
      new LedgerWalletAdapter(),
      new TrustWalletAdapter(),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
