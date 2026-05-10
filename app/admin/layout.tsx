'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Keypair } from '@solana/web3.js';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Shield, Lock } from 'lucide-react';
import adminSecret from '@/contracts/keys/admin.json';
import { AdminVaultProvider } from '@/components/admin/AdminVaultContext';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AppProviders } from '@/components/providers/app-providers';

const ADMIN_PUBKEY = Keypair.fromSecretKey(
  Uint8Array.from(adminSecret as number[]),
).publicKey.toBase58();

function WalletGate() {
  const [mounted, setMounted] = useState(false);
  const wallet = useAnchorWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!wallet) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background">
        <div className="mx-auto max-w-sm space-y-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.03] shadow-2xl">
            <Lock className="h-9 w-9 text-white/30" strokeWidth={1} />
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-3xl tracking-tight text-white">Protocol Operations</h1>
            <p className="text-sm text-white/40">
              Connect the authorized admin wallet to access the control center.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/15">
              Sequence: {ADMIN_PUBKEY.slice(0, 12)}…
            </p>
          </div>
          <div className="flex justify-center">
            <WalletMultiButton style={{}} />
          </div>
        </div>
      </div>
    );
  }

  if (wallet.publicKey.toBase58() !== ADMIN_PUBKEY) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background">
        <div className="mx-auto max-w-sm space-y-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-500/20 bg-rose-500/[0.06] shadow-2xl">
            <Shield className="h-9 w-9 text-rose-400" strokeWidth={1} />
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-3xl tracking-tight text-white">Access Denied</h1>
            <p className="text-sm text-white/40">
              This identity is not registered as a protocol controller.
            </p>
            <div className="mt-6 space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-left">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/20">Connected ID</div>
                <div className="mt-1 font-mono text-[11px] text-rose-300 break-all">{wallet.publicKey.toBase58()}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/20">Authorized ID</div>
                <div className="mt-1 font-mono text-[11px] text-white/40 break-all">{ADMIN_PUBKEY}</div>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <WalletMultiButton style={{}} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function AdminShell({ children }: { children: ReactNode }) {
  const wallet = useAnchorWallet();
  const isAuthorized = wallet?.publicKey.toBase58() === ADMIN_PUBKEY;

  return (
    <>
      <WalletGate />
      {isAuthorized && (
        <AdminVaultProvider>
          <div className="fixed inset-0 z-[60] flex bg-background">
            <AdminSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <AdminTopbar />
              <main className="flex-1 overflow-x-hidden overflow-y-auto" data-app-scroll="true">
                {children}
              </main>
            </div>
          </div>
        </AdminVaultProvider>
      )}
    </>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AdminShell>{children}</AdminShell>
    </AppProviders>
  );
}
