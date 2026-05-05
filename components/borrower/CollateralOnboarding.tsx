'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Copy, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { 
  useCurrentAccount, 
  useConnectWallet, 
  useDisconnectWallet,
  useWallets,
  useSignAndExecuteTransaction,
  useSignPersonalMessage
} from '@mysten/dapp-kit';
import { fromBase64 } from '@mysten/sui/utils';
// @ts-ignore
import { Transaction } from '@mysten/sui/transactions';

import { IKA_CHAIN, IkaChain, createIkaDwallet, type IkaDkgStep } from '@/app/lib/ika';
import {
  useIkaCollateralAccount,
  useAttachIkaCollateral,
  useVerifyIkaCollateral,
  useReleaseIkaCollateral,
  useLoanAccount,
} from '@/hooks/useIkaCollateral';
import { getVaultPda, getLoanPda } from '@/app/lib/pda';

const TEST_ORACLE_PUBKEY = '5nmEq5cNc9yXpK1ySrb4XH65zccBvRK2hwKnEJePjcrf';

const CHAIN_LABELS: Record<IkaChain, string> = {
  [IKA_CHAIN.BTC]: 'Bitcoin',
  [IKA_CHAIN.ETH]: 'Ethereum',
  [IKA_CHAIN.SUI]: 'Sui',
};

const DKG_STEP_LABELS: Record<IkaDkgStep, string> = {
  initializing: 'Connecting to IKA Network...',
  preparing_keys: 'Deriving threshold shares...',
  registering_encryption_key: 'Registering on-chain keys...',
  running_dkg_wasm: 'Running DKG (MPC protocol)...',
  submitting_sui_tx: 'Submitting Sui transaction...',
  extracting_dwallet: 'Finalizing dWallet creation...',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Locked: 'bg-green-100 text-green-800 border-green-200',
  Released: 'bg-blue-100 text-blue-800 border-blue-200',
  Liquidated: 'bg-red-100 text-red-800 border-red-200',
};

interface Props {
  vaultId: number;
  loanId: number;
}

export function CollateralOnboarding({ vaultId, loanId }: Props) {
  const { connected } = useWallet();

  const [vaultPda] = getVaultPda(vaultId);
  const [loanPda] = getLoanPda(vaultPda, loanId);

  const { data: collateral, isLoading } = useIkaCollateralAccount(loanPda);
  const { data: loan } = useLoanAccount(loanPda);
  const loanIsRepaid = loan?.state != null && 'repaid' in (loan.state as object);

  const attachMutation = useAttachIkaCollateral();
  const { verify, isPolling } = useVerifyIkaCollateral();
  const releaseMutation = useReleaseIkaCollateral();

  // ── Form state ────────────────────────────────────────────────────────────
  const [dwalletIdHex, setDwalletIdHex] = useState('');
  const [chainId, setChainId] = useState<IkaChain>(IKA_CHAIN.BTC);
  const [collateralUsd, setCollateralUsd] = useState('');
  const [oracleKey, setOracleKey] = useState(TEST_ORACLE_PUBKEY);
  const [isCreatingDwallet, setIsCreatingDwallet] = useState(false);
  const [currentDkgStep, setCurrentDkgStep] = useState<IkaDkgStep | null>(null);

  // ── Sui Wallet state ──────────────────────────────────────────────────────
  const currentAccount = useCurrentAccount();
  const { mutate: connect } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const wallets = useWallets();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  
  const suiAddress = currentAccount?.address ?? '';
  const [copied, setCopied] = useState(false);

  // ── Sui balances ──────────────────────────────────────────────────────────
  const { data: suiBalances } = useQuery({
    queryKey: ['suiBalances', suiAddress],
    enabled: !!suiAddress,
    refetchInterval: 15_000,
    queryFn: async () => {
      const res = await fetch('/api/sui-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getAllBalances',
          params: [suiAddress],
        }),
      });
      const json = await res.json();
      const balances: Array<{ coinType: string; totalBalance: string }> = json.result ?? [];
      const sui = balances.find(b => b.coinType === '0x2::sui::SUI');
      const ika = balances.find(b => b.coinType.toLowerCase().includes('::ika::'));
      return {
        sui: sui ? Number(sui.totalBalance) / 1e9 : 0,
        ika: ika ? Number(ika.totalBalance) / 1e9 : 0,
        ikaRaw: ika?.totalBalance ?? '0',
      };
    },
  });

  useEffect(() => {
    const cached = localStorage.getItem('prism_ika_dwallet');
    if (cached) setDwalletIdHex(cached);
  }, []);

  if (!connected) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-black/35 p-8 text-center">
        <p className="text-sm text-white/40">
          Connect wallet to manage IKA collateral.
        </p>
      </div>
    );
  }

  // ── Collateral already exists — show status panel ─────────────────────────
  if (collateral) {
    const dwalletHex = Buffer.from(collateral.dwalletId).toString('hex');

    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">IKA Collateral</h3>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-wider ${STATUS_COLORS[collateral.status]?.replace('bg-yellow-100', 'bg-yellow-500/10').replace('text-yellow-800', 'text-yellow-400').replace('border-yellow-200', 'border-yellow-500/30').replace('bg-green-100', 'bg-green-500/10').replace('text-green-800', 'text-green-400').replace('border-green-200', 'border-green-500/30').replace('bg-blue-100', 'bg-blue-500/10').replace('text-blue-800', 'text-blue-400').replace('border-blue-200', 'border-blue-500/30').replace('bg-red-100', 'bg-red-500/10').replace('text-red-800', 'text-red-400').replace('border-red-200', 'border-red-500/30') ?? ''}`}>
            {collateral.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40">dWallet ID</div>
            <div className="font-mono text-xs text-white/80 truncate" title={dwalletHex}>
              {dwalletHex.slice(0, 16)}…
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Chain</div>
            <div className="text-sm text-white/80">{CHAIN_LABELS[collateral.chainId as IkaChain]}</div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Collateral (USD)</div>
            <div className="text-lg font-display text-white">
              ${(Number(collateral.collateralAmountUsd) / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40">Oracle</div>
            <div className="font-mono text-xs text-white/60 truncate" title={collateral.oraclePubkey.toBase58()}>
              {collateral.oraclePubkey.toBase58().slice(0, 12)}…
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          {collateral.lockedTs > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/40">Locked at</span>
              <span className="text-white/30">{new Date(collateral.lockedTs * 1000).toLocaleString()}</span>
            </div>
          )}
        </div>

        {collateral.status === 'Pending' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-white/[0.04] border border-white/5 p-4 flex gap-3">
              <div className="h-2 w-2 rounded-full bg-yellow-400 mt-1 animate-pulse" />
              <p className="text-xs text-white/50 leading-5">
                Waiting for IKA oracle to confirm your on-chain lock.
                Click Verify once your BTC/ETH transaction is confirmed.
              </p>
            </div>
            <button
              disabled={isPolling}
              onClick={async () => {
                try {
                  const sig = await verify({
                    vaultId,
                    loanId,
                    dwalletId: collateral.dwalletId,
                    chainId: collateral.chainId as IkaChain,
                  });
                  toast.success(`Collateral verified! tx: ${sig.slice(0, 16)}…`);
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Verification failed');
                }
              }}
              className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 hover:bg-purple-500 transition-all disabled:opacity-50"
            >
              {isPolling ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  <span>Polling IKA oracle…</span>
                </div>
              ) : (
                'Verify Collateral Lock'
              )}
            </button>
          </div>
        )}

        {collateral.status === 'Locked' && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 flex gap-3">
            <div className="h-2 w-2 rounded-full bg-green-400 mt-1" />
            <p className="text-xs text-green-400/80 leading-5">
              Collateral is locked. Your loan can now be disbursed by the admin.
            </p>
          </div>
        )}

        {collateral.status === 'Locked' && (
          loanIsRepaid ? (
            <button
              disabled={releaseMutation.isPending}
              onClick={() => releaseMutation.mutate({ vaultId, loanId })}
              className="w-full rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
            >
              {releaseMutation.isPending ? 'Releasing…' : 'Release Collateral'}
            </button>
          ) : (
            <div className="rounded-lg bg-white/[0.04] border border-white/5 p-4 text-xs text-white/40 leading-5">
              Repay your loan in full before releasing collateral.
            </div>
          )
        )}

        {collateral.status === 'Released' && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-xs text-blue-400/80 leading-5">
            Collateral released. IKA Network will unlock your BTC/ETH.
          </div>
        )}

        {collateral.status === 'Liquidated' && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400/80 leading-5">
            Collateral has been liquidated due to loan default.
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded" />
        <div className="h-24 bg-white/5 rounded" />
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function handleCreateDwallet() {
    if (!currentAccount) {
      toast.error('Connect your Sui wallet first');
      return;
    }
    
    setIsCreatingDwallet(true);
    setCurrentDkgStep('initializing');
    
    try {
      // 1. Derive rootSeed by asking the wallet to sign a constant message.
      const signResult = await signPersonalMessage({
        message: new TextEncoder().encode('PRISM Protocol IKA Seed'),
      });
      
      // signature is a base64 string. Decode it and use first 32 bytes as seed.
      const sigBytes = fromBase64(signResult.signature);
      const rootSeed = sigBytes.slice(0, 32); 

      // 2. Run the DKG process.
      const info = await createIkaDwallet(
        suiAddress, 
        rootSeed as unknown as Uint8Array,
        async (tx, client) => {
          try {
            console.log('PRISM: Serializing Sui transaction...', tx);
            const txBytes = await tx.build({ client });
            const cleanTx = Transaction.from(txBytes);
            console.log('PRISM: Executing clean transaction...');
            return await signAndExecuteTransaction({ transaction: cleanTx });
          } catch (err: any) {
            const errMsg = err.message || String(err);
            if (errMsg.includes('abort code: 0') || errMsg.includes('dynamic_field::add')) {
              console.warn('PRISM: Detected existing registration during simulation, proceeding...');
              return { digest: 'ALREADY_REGISTERED' };
            }
            console.error('PRISM: Sui transaction failed:', err);
            throw err;
          }
        },
        (step) => {
          setCurrentDkgStep(step);
          if (step === 'registering_encryption_key') toast.info('Registering encryption key...');
          if (step === 'running_dkg_wasm') toast.info('Computing DKG shares...');
          if (step === 'submitting_sui_tx') toast.info('Submitting DKG request...');
        }
      );

      const hex = Buffer.from(info.dwalletId).toString('hex');
      setDwalletIdHex(hex);
      localStorage.setItem('prism_ika_dwallet', hex);
      toast.success(`dWallet created: ${info.dwalletObjectId.slice(0, 20)}…`);
    } catch (e: unknown) {
      console.error('DKG Error:', e);
      toast.error(e instanceof Error ? e.message : 'dWallet creation failed');
    } finally {
      setIsCreatingDwallet(false);
      setCurrentDkgStep(null);
    }
  }

  function handleCopyAddress() {
    navigator.clipboard.writeText(suiAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleAttach() {
    if (!dwalletIdHex || dwalletIdHex.length !== 64) {
      toast.error('Create a dWallet first or paste a valid 64-char dWallet ID');
      return;
    }
    const usd = parseFloat(collateralUsd);
    if (isNaN(usd) || usd <= 0) {
      toast.error('Enter a valid collateral USD amount');
      return;
    }
    let oraclePk: PublicKey;
    try {
      oraclePk = new PublicKey(oracleKey);
    } catch {
      toast.error('Invalid oracle public key');
      return;
    }

    attachMutation.mutate({
      vaultId,
      loanId,
      dwallet: { dwalletId: Buffer.from(dwalletIdHex, 'hex'), dwalletObjectId: '' },
      chainId,
      collateralAmountUsd: BigInt(Math.round(usd * 1_000_000)),
      oraclePubkey: oraclePk,
    });
  }

  // ── Attach form ───────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-white">Attach IKA Collateral</h3>
        <p className="mt-2 text-xs text-white/50 leading-relaxed">
          Lock BTC or ETH in an IKA dWallet and register it here as loan collateral.
          The IKA oracle will attest the lock on-chain before disbursement.
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Step 1: IKA Wallet card — only shown when no dWallet exists yet ─ */}
        {!dwalletIdHex && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.03] p-5 space-y-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold text-purple-400">
              <div className="h-1 w-1 rounded-full bg-purple-400" />
              Step 1 — Create your IKA Wallet
            </div>

            {suiAddress ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5">
                  <span className="flex-1 font-mono text-[11px] text-white/60 truncate">{suiAddress}</span>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="shrink-0 text-white/20 hover:text-purple-400 transition-colors"
                    title="Copy address"
                  >
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="text-[10px] text-white/20 hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="flex items-center gap-4 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-white/30">SUI</span>
                    <span className={`font-mono text-xs font-medium ${suiBalances && suiBalances.sui > 0 ? 'text-green-400' : 'text-white/40'}`}>
                      {suiBalances ? suiBalances.sui.toFixed(4) : '—'}
                    </span>
                  </div>
                  <div className="h-3 w-px bg-white/10" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-white/30">IKA</span>
                    <span className={`font-mono text-xs font-medium ${suiBalances && suiBalances.ika > 0 ? 'text-purple-400' : 'text-white/40'}`}>
                      {suiBalances ? suiBalances.ika.toFixed(4) : '—'}
                    </span>
                  </div>
                  {(!suiBalances || (suiBalances.sui === 0 && suiBalances.ika === 0)) && (
                    <span className="ml-auto text-[10px] text-yellow-400/70">needs funding</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-white/40 leading-5">
                  Connect your Sui wallet to create a secure, threshold-encrypted dWallet for your collateral.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => connect({ wallet })}
                      className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-white/70 hover:bg-white/[0.05] hover:text-white transition-all"
                    >
                      {wallet.icon && <img src={wallet.icon} alt="" className="h-3 w-3" />}
                      Connect {wallet.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {suiAddress && (
              <p className="text-xs text-white/40 leading-5">
                Fund this address with testnet SUI + IKA tokens, then click Create dWallet.
              </p>
            )}

            <div className="flex gap-3">
              <a
                href="https://faucet.sui.io/?network=testnet"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.05] hover:text-white transition-all"
              >
                <ExternalLink className="h-3 w-3" />
                Get testnet tokens
              </a>
              <button
                disabled={isCreatingDwallet || !suiAddress}
                onClick={handleCreateDwallet}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 shadow-lg shadow-purple-900/20 disabled:opacity-50 transition-all"
              >
                {isCreatingDwallet ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span>{currentDkgStep ? DKG_STEP_LABELS[currentDkgStep] : 'Running DKG…'}</span>
                  </div>
                ) : (
                  'Create dWallet'
                )}
              </button>
              <button
                type="button"
                title="Generate a simulated dWallet ID without IKA network — for local testing only"
                onClick={() => {
                  const fake = new Uint8Array(32);
                  crypto.getRandomValues(fake);
                  const hex = Array.from(fake).map(b => b.toString(16).padStart(2, '0')).join('');
                  setDwalletIdHex(hex);
                  localStorage.setItem('prism_ika_dwallet', hex);
                  toast.success('Simulated dWallet ID ready (dev mode)');
                }}
                className="rounded-lg border border-yellow-500/30 bg-yellow-500/[0.08] px-3 py-2 text-[11px] font-medium text-yellow-400 hover:bg-yellow-500/[0.15] transition-all"
              >
                Simulate
              </button>
            </div>
          </div>
        )}

        {/* ── Existing dWallet indicator ───────────────────────────────────── */}
        {dwalletIdHex && (
          <div className="flex items-center justify-between rounded-xl border border-green-500/20 bg-green-500/[0.03] px-4 py-3">
            <span className="flex items-center gap-2 text-xs font-medium text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              IKA dWallet ready
            </span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[11px] text-green-400/60">{dwalletIdHex.slice(0, 12)}…</span>
              <button
                type="button"
                onClick={handleCreateDwallet}
                disabled={isCreatingDwallet}
                className="text-[11px] text-green-400/40 hover:text-green-400 hover:underline disabled:opacity-50 transition-colors"
              >
                {isCreatingDwallet ? 'Recreating…' : 'Recreate'}
              </button>
            </div>
          </div>
        )}

        {/* ── Register collateral ──────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold text-white/40">
            <div className="h-1 w-1 rounded-full bg-white/20" />
            {dwalletIdHex ? 'Register Collateral' : 'Step 2 — Register Collateral'}
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wider font-medium text-white/40">Chain</label>
              <div className="relative">
                <select
                  value={chainId}
                  onChange={(e) => setChainId(Number(e.target.value) as IkaChain)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                >
                  <option value={IKA_CHAIN.BTC} className="bg-[#0a0a0a]">Bitcoin (BTC)</option>
                  <option value={IKA_CHAIN.ETH} className="bg-[#0a0a0a]">Ethereum (ETH)</option>
                  <option value={IKA_CHAIN.SUI} className="bg-[#0a0a0a]">Sui</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wider font-medium text-white/40">
                Collateral Value (USD)
              </label>
              <div className="group relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/20 group-focus-within:text-purple-400">$</span>
                <input
                  type="number"
                  min="0"
                  value={collateralUsd}
                  onChange={(e) => setCollateralUsd(e.target.value)}
                  placeholder="50,000"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-8 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
            </div>
          </div>

          {!dwalletIdHex && (
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wider font-medium text-white/40">
                dWallet ID (optional)
              </label>
              <input
                value={dwalletIdHex}
                onChange={(e) => setDwalletIdHex(e.target.value.trim().toLowerCase())}
                placeholder="Or paste a 64-char dWallet ID from IKA dashboard"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-wider font-medium text-white/40">
              IKA Oracle Public Key
            </label>
            <input
              value={oracleKey}
              onChange={(e) => setOracleKey(e.target.value.trim())}
              placeholder="IKA oracle ed25519 pubkey (base58)"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
            {oracleKey === TEST_ORACLE_PUBKEY && (
              <p className="text-[10px] text-purple-400/60 px-1 italic">Using local test oracle</p>
            )}
          </div>
        </div>
      </div>

      <button
        disabled={attachMutation.isPending || !dwalletIdHex}
        onClick={handleAttach}
        className="w-full rounded-xl bg-purple-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-purple-900/20 hover:bg-purple-500 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {attachMutation.isPending ? (
          <div className="flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <span>Registering Collateral…</span>
          </div>
        ) : (
          'Register IKA Collateral'
        )}
      </button>
    </div>
  );
}
