'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Copy, ExternalLink, CheckCircle2, Shield, Zap, BadgeCheck, Clock, Activity, Wallet, ArrowRight, Lock } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { QRCodeCanvas } from 'qrcode.react';

import { 
  IKA_CHAIN, 
  IkaChain, 
  createIkaDwallet, 
  getDWalletAddress,
  type IkaDkgStep 
} from '@/app/lib/ika';
import { Progress } from '@/components/ui/progress';
import {
  useIkaCollateralAccount,
  useAttachIkaCollateral,
  useVerifyIkaCollateral,
  useReleaseIkaCollateral,
  useLoanAccount,
} from '@/hooks/useIkaCollateral';
import { useRepayLoan } from '@/hooks/useRepayLoan';
import { useFiatRepaymentStatus } from '@/hooks/useFiatRepaymentStatus';
import { PRISM_CORE_PROGRAM_ID } from '@/app/lib/constants';
import { getVaultPda, getLoanPda } from '@/app/lib/pda';

// Must match a key in the GlobalConfig oracle_allowlist.
// Corresponds to IKA_TEST_ORACLE_SECRET_SEED in .env.local — currently the admin keypair.
const TEST_ORACLE_PUBKEY = 'qJnBaWcB2Yvd2MSf1s2XweMEd91RHgdG88ad8cAmbDK';

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
  defaultCollateralUsd?: number;
}

export function CollateralOnboarding({ vaultId, loanId, defaultCollateralUsd }: Props) {
  const { connected } = useWallet();

  const [vaultPda] = getVaultPda(Number(vaultId));
  const [loanPda] = getLoanPda(vaultPda, Number(loanId));

  const { data: collateral, isLoading } = useIkaCollateralAccount(loanPda);
  const { data: loan } = useLoanAccount(loanPda);
  const attachMutation = useAttachIkaCollateral();
  const { verify, isPolling } = useVerifyIkaCollateral();
  const releaseMutation = useReleaseIkaCollateral();

  // ── Derived State ─────────────────────────────────────────────────────────
  const loanState = loan?.state ? Object.keys(loan.state)[0].toLowerCase() : 'none';
  const isCollateralSecured = collateral?.status === 'Locked' || collateral?.status === 'Released';
  const isDisbursed = ['active', 'repaying', 'repaid', 'resolved', 'defaulted'].includes(loanState);
  const isFundsDelivered = ['active', 'repaying', 'repaid', 'resolved', 'defaulted'].includes(loanState);
  const loanIsRepaid = ['repaid', 'resolved'].includes(loanState);

  // ── Form state ────────────────────────────────────────────────────────────
  const [dwalletIdHex, setDwalletIdHex] = useState('');
  const [chainId, setChainId] = useState<IkaChain>(IKA_CHAIN.BTC);
  const [collateralUsd, setCollateralUsd] = useState('');
  const [oracleKey, setOracleKey] = useState(TEST_ORACLE_PUBKEY);

  useEffect(() => {
    if (defaultCollateralUsd && defaultCollateralUsd > 0) {
      setCollateralUsd(String(defaultCollateralUsd));
    }
  }, [defaultCollateralUsd]);
  const [isCreatingDwallet, setIsCreatingDwallet] = useState(false);
  const [currentDkgStep, setCurrentDkgStep] = useState<IkaDkgStep | null>(null);
  const [depositAddress, setDepositAddress] = useState<string>('');

  const [repayAmount, setRepayAmount] = useState('');
  const repayMutation = useRepayLoan();
  const { data: fiatStatus } = useFiatRepaymentStatus(Number(loanId));
  const [depositAddressError, setDepositAddressError] = useState<string>('');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  const accruedInterest = useMemo(() => {
    if (!loan || !isDisbursed) return 0n;
    const now = Math.floor(Date.now() / 1000);
    const startTime = Number(loan.originationTs.toString());
    const durationSec = Math.max(0, now - startTime);
    const aprBps = loan.aprBps;
    const principal = BigInt(loan.principal.toString());
    
    // SEC_PER_YEAR = 365 * 24 * 3600 = 31536000 (Matches on-chain math)
    const SEC_PER_YEAR = 31536000;
    return (principal * BigInt(aprBps) * BigInt(durationSec)) / BigInt(SEC_PER_YEAR * 10000);
  }, [loan, isDisbursed]);

  const totalDebt = (loan ? BigInt(loan.principal.toString()) : 0n) + accruedInterest;

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

  // Fetch deposit address when collateral is Pending
  useEffect(() => {
    if (collateral?.status === 'Pending') {
      const dwalletObjectId = '0x' + Buffer.from(collateral.dwalletId).toString('hex');
      setIsFetchingAddress(true);
      setDepositAddressError('');
      getDWalletAddress(dwalletObjectId, collateral.chainId as IkaChain)
        .then(addr => { setDepositAddress(addr); setDepositAddressError(''); })
        .catch(err => {
          const msg = err instanceof Error ? err.message : String(err);
          setDepositAddressError(msg);
          console.error('Failed to fetch deposit address:', err);
        })
        .finally(() => setIsFetchingAddress(false));
    }
  }, [collateral?.status, collateral?.dwalletId, collateral?.chainId]);

  // ── dWallet creation — defined before conditional returns so it's accessible
  //    from both the "collateral exists" panel and the "attach form" below.
  async function handleCreateDwallet() {
    if (!currentAccount) {
      toast.error('Connect your Sui wallet first');
      return;
    }
    setIsCreatingDwallet(true);
    setCurrentDkgStep('initializing');
    try {
      const signResult = await signPersonalMessage({
        message: new TextEncoder().encode('PRISM Protocol IKA Seed'),
      });
      const sigBytes = fromBase64(signResult.signature);
      const rootSeed = sigBytes.slice(0, 32);
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
        },
      );
      const hex = Buffer.from(info.dwalletId).toString('hex');
      setDwalletIdHex(hex);
      localStorage.setItem('prism_ika_dwallet', hex);
      toast.success(`dWallet created: ${info.dwalletObjectId.slice(0, 20)}…`);

      // If we already have a collateral account on Solana, update it with the new dWallet ID.
      if (collateral && collateral.status === 'Pending') {
        console.log('PRISM: Updating Solana collateral registration with new dWallet ID:', hex);
        toast.info('Updating Solana registration...');
        attachMutation.mutate({
          vaultId,
          loanId,
          dwallet: info,
          chainId: collateral.chainId as IkaChain,
          collateralAmountUsd: collateral.collateralAmountUsd,
          oraclePubkey: collateral.oraclePubkey,
        });
      }
    } catch (e: unknown) {
      console.error('DKG Error:', e);
      toast.error(e instanceof Error ? e.message : 'dWallet creation failed');
    } finally {
      setIsCreatingDwallet(false);
      setCurrentDkgStep(null);
    }
  }

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
          <span className={`rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider ${STATUS_COLORS[collateral.status]?.replace('bg-yellow-100', 'bg-yellow-500/10').replace('text-yellow-800', 'text-yellow-400').replace('border-yellow-200', 'border-yellow-500/30').replace('bg-green-100', 'bg-green-500/10').replace('text-green-800', 'text-green-400').replace('border-green-200', 'border-green-500/30').replace('bg-blue-100', 'bg-blue-500/10').replace('text-blue-800', 'text-blue-400').replace('border-blue-200', 'border-blue-500/30').replace('bg-red-100', 'bg-red-500/10').replace('text-red-800', 'text-red-400').replace('border-red-200', 'border-red-500/30') ?? ''}`}>
            {collateral.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-white/40">dWallet ID</div>
            <div className="font-mono text-xs text-white/80 truncate" title={dwalletHex}>
              {dwalletHex.slice(0, 16)}…
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-white/40">Chain</div>
            <div className="text-sm text-white/80">{CHAIN_LABELS[collateral.chainId as IkaChain]}</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-white/40">Collateral (USD)</div>
            <div className="text-lg font-display text-white">
              ${(Number(collateral.collateralAmountUsd) / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-white/40">Oracle</div>
            <div className="font-mono text-xs text-white/60 truncate" title={collateral.oraclePubkey.toBase58()}>
              {collateral.oraclePubkey.toBase58().slice(0, 12)}…
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          {collateral.lockedTs > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/40">Locked at</span>
              <span className="text-white/30">{new Date(collateral.lockedTs * 1000).toLocaleString()}</span>
            </div>
          )}
        </div>

        {collateral.status === 'Pending' && (
          <>

            <div className="space-y-4">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.03] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-yellow-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                  Phase 3 — Funding & Monitoring
                </div>
                {isFetchingAddress && <div className="h-3 w-3 animate-spin rounded-full border border-yellow-500/20 border-t-yellow-500" />}
              </div>

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <p className="text-xs text-white/50 leading-relaxed">
                    To finalize your collateral, send your {CHAIN_LABELS[collateral.chainId as IkaChain]} to the decentralized vault address below.
                  </p>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wider text-white/30 font-medium">Deposit Address</div>
                    {depositAddressError ? (
                      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] p-4 space-y-3">
                        <p className="text-sm text-yellow-400/80 leading-relaxed font-mono">
                          {depositAddressError}
                        </p>
                        {depositAddressError.includes('NetworkRejectedDKGVerification') && (
                          <button
                            onClick={handleCreateDwallet}
                            disabled={isCreatingDwallet}
                            className="flex items-center gap-2 rounded-lg bg-yellow-500/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-yellow-500 hover:bg-yellow-500/30 transition-all disabled:opacity-50"
                          >
                            {isCreatingDwallet ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-500/20 border-t-yellow-500" />
                            ) : (
                              'Re-create dWallet'
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-3">
                        <div className="flex flex-col gap-1 flex-1">
                          <span className="font-mono text-sm text-white/80 break-all">
                            {isFetchingAddress ? 'Resolving vault (approx. 60-90s)…' : depositAddress || '—'}
                          </span>
                          {isFetchingAddress && (
                            <span className="text-xs text-yellow-500/50 animate-pulse font-medium uppercase tracking-tight">
                              Waiting for IKA Network DKG Finalization
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (depositAddress) {
                              navigator.clipboard.writeText(depositAddress);
                              toast.success('Address copied');
                            }
                          }}
                          disabled={!depositAddress}
                          className="p-1.5 text-white/20 hover:text-yellow-500 transition-colors disabled:opacity-30"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wider">
                      <span className="text-white/30 font-medium">Monitoring Status</span>
                      <span className="text-yellow-500 animate-pulse">Active</span>
                    </div>
                    <div className="space-y-1.5">
                      <Progress value={isPolling ? 66 : 33} className="h-1.5 bg-white/5" />
                      <div className="flex justify-between text-xs text-white/20 font-mono">
                        <span>Waiting for Tx</span>
                        <span>Confirming</span>
                        <span>Verified</span>
                      </div>
                    </div>
                  </div>
                </div>

                {depositAddress && !depositAddressError && (
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className="p-2.5 rounded-xl bg-white border border-white/10 shadow-xl shadow-black/50">
                      <QRCodeCanvas
                        value={depositAddress}
                        size={120}
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: '/favicon.ico',
                          x: undefined,
                          y: undefined,
                          height: 24,
                          width: 24,
                          excavate: true,
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/30 uppercase tracking-widest font-semibold mt-1">Scan to Fund</span>
                  </div>
                )}
              </div>
            </div>

            <button
              disabled={isPolling || !depositAddress || isFetchingAddress}
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
        </>
      )}

        {collateral.status === 'Locked' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-700">
            {/* ── Milestone Header ────────────────────────────────────────── */}
            <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-emerald-500/10">
                  <BadgeCheck className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white tracking-tight">Collateral successfully registered and secured.</h3>
                  <p className="mt-1 text-sm text-white/40 leading-relaxed max-w-xl">
                    Your {CHAIN_LABELS[collateral.chainId as IkaChain]} collateral has been locked and verified through the IKA custody flow. 
                    Your credit facility is now fully secured and awaiting final USDC disbursement from the vault.
                  </p>
                  <div className="mt-4 flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs uppercase tracking-widest text-white/20">Custody Confirmation</span>
                      <span className="font-mono text-xs text-emerald-400/80 mt-0.5">Verified by IKA Oracle</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs uppercase tracking-widest text-white/20">Secured At</span>
                      <span className="font-mono text-xs text-white/50 mt-0.5">
                        {new Date(Number(collateral.lockedTs) * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Funding Dashboard ────────────────────────────────────────── */}
            <div className="grid sm:grid-cols-2 gap-4">
              
              {/* Facility Readiness Panel */}
              <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.05]">
                  <div className="font-mono text-xs uppercase tracking-widest text-white/30">Facility Readiness</div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-xs uppercase tracking-widest text-emerald-400/70">Ready</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Facility Amount', value: `$${(Number(loan?.amount ?? 0) / 1e6).toLocaleString()} USDC`, icon: Wallet },
                    { label: 'Collateral Verified', value: 'Confirmed', icon: Shield, ok: true },
                    { label: 'Custody State', value: 'Active / Threshold', icon: Lock, ok: true },
                    { label: 'Capital Reserved', value: 'Vault Committed', icon: Zap, ok: true },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-3 w-3 text-white/20" />
                        <span className="font-mono text-xs uppercase tracking-widest text-white/30">{item.label}</span>
                      </div>
                      <span className={cn("font-mono text-xs", item.ok ? "text-emerald-400/60" : "text-white/60")}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Funding Pipeline Tracker */}
              <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
                <div className="font-mono text-xs uppercase tracking-widest text-white/30 pb-2 border-b border-white/[0.05]">Funding Pipeline</div>
                <div className="space-y-3 relative">
                  {[
                    { label: 'Credit Approval', status: 'done' as const },
                    { label: 'Collateral Secured', status: (isCollateralSecured ? 'done' : 'active') as const },
                    { label: 'Vault Disbursement', status: (isDisbursed ? 'done' : (isCollateralSecured ? 'active' : 'pending')) as const },
                    { label: 'Funds Delivered', status: (isFundsDelivered ? 'done' : 'pending') as const },
                  ].map((step, idx, arr) => (
                    <div key={idx} className="flex items-center gap-3 relative z-10">
                      <div className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
                        step.status === 'done' ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : step.status === 'active' ? "border-white/40 bg-white/5 text-white animate-pulse"
                        : "border-white/10 bg-transparent text-white/10"
                      )}>
                        {step.status === 'done' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <div className={cn("h-1 w-1 rounded-full", step.status === 'active' ? "bg-white" : "bg-white/10")} />}
                      </div>
                      <span className={cn(
                        "font-mono text-xs uppercase tracking-wider",
                        step.status === 'done' ? "text-emerald-400/50" : step.status === 'active' ? "text-white/70" : "text-white/10"
                      )}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── USDC Status & Next Steps ──────────────────────────────────── */}
            {!isDisbursed ? (
              <div className="rounded-sm border border-amber-500/15 bg-amber-500/[0.03] p-5">
                <div className="flex items-start gap-4">
                  <Clock className="h-5 w-5 text-amber-400/40 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-200/80 uppercase tracking-wider">Disbursement Execution Pending</span>
                      <span className="font-mono text-xs text-amber-500/50">Next: Admin Action</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/40 max-w-xl">
                      <span className="text-amber-200/60 font-bold uppercase tracking-tight">Important:</span> USDC has not yet been transferred to your wallet. Funding occurs after the final vault disbursement execution by the Protocol Admin.
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-white/20">
                      <Activity className="h-3 w-3" />
                      <span>Your collateral is now protecting the credit facility. Repayment controls will activate once the loan enters <span className="text-white/40 font-bold italic">Active</span> status.</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-sm border border-emerald-500/15 bg-emerald-500/[0.03] p-5">
                <div className="flex items-start gap-4">
                  <BadgeCheck className="h-5 w-5 text-emerald-400/40 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-200/80 uppercase tracking-wider">Facility Fully Funded</span>
                      <span className="font-mono text-xs text-emerald-500/50">Status: Active</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/40 max-w-xl">
                      USDC principal has been disbursed to your wallet. Your credit facility is now active and accruing interest according to the protocol schedule.
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex items-center gap-2 text-xs text-white/20">
                        <Activity className="h-3 w-3" />
                        <span>Interest Accruing</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/20">
                        <Wallet className="h-3 w-3" />
                        <span>USDC Delivered</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Repayment Zone — Active when disbursed */}
            {isDisbursed && !loanIsRepaid && (
              <div className="mt-5 space-y-4">
                <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-white/40 uppercase tracking-widest">Active Repayment</span>
                    {fiatStatus?.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="font-mono text-xs text-amber-500/80 uppercase">Fiat Intent Pending</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={repayAmount}
                        onChange={(e) => setRepayAmount(e.target.value)}
                        placeholder="Enter amount..."
                        className="w-full rounded-sm border border-white/[0.1] bg-black/40 px-3 py-2.5 font-mono text-xs text-white placeholder:text-white/10 focus:border-emerald-500/30 focus:outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-white/20 uppercase">USDC</span>
                    </div>
                    <button
                      disabled={repayMutation.isPending || !repayAmount}
                      onClick={() => {
                        repayMutation.mutate({
                          vaultId: Number(vaultId),
                          loanId: Number(loanId),
                          amountUsdc: Number(repayAmount),
                        });
                        setRepayAmount('');
                      }}
                      className="rounded-sm bg-emerald-500/80 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-950 hover:bg-emerald-400 disabled:opacity-50 transition-all"
                    >
                      {repayMutation.isPending ? 'Processing…' : 'Repay'}
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs text-white/20 uppercase">Total Repaid</span>
                      <span className="font-mono text-sm text-emerald-400/60">
                        ${loan ? (Number(loan.totalRepaid.toString()) / 1_000_000).toLocaleString() : '0.00'} USDC
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-xs text-white/20 uppercase">Accrued Interest</span>
                      <span className="font-mono text-sm text-amber-400/60">
                        ${(Number(accruedInterest) / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 4 })} USDC
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-xs text-white/20 uppercase">Total Debt</span>
                      <span className="font-mono text-sm text-white/60">
                        ${(Number(totalDebt) / 1_000_000).toLocaleString()} USDC
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contextual Action Logic */}
            {loanIsRepaid ? (
              <button
                disabled={releaseMutation.isPending}
                onClick={() => releaseMutation.mutate({ vaultId, loanId })}
                className="w-full rounded-sm border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
              >
                {releaseMutation.isPending ? 'Releasing…' : 'Release Collateral'}
              </button>
            ) : (
              <div className="rounded-sm border border-white/[0.04] bg-white/[0.02] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-white/10" />
                  <span className="font-mono text-xs text-white/20 uppercase tracking-widest">Facility Protection Active</span>
                </div>
                <div className="font-mono text-xs text-white/20 italic">
                  Settlement required for collateral release
                </div>
              </div>
            )}
          </div>
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
      {/* Debug Info */}
      <div className="p-2 bg-black/40 rounded border border-white/5 font-mono text-xs text-white/20 mb-4 break-all">
        Vault: {vaultPda.toBase58()}<br/>
        Loan: {loanPda.toBase58()} (ID: {loanId})<br/>
        Prog: {PRISM_CORE_PROGRAM_ID.toBase58()}
      </div>
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
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-purple-400">
              <div className="h-1 w-1 rounded-full bg-purple-400" />
              Step 1 — Create your IKA Wallet
            </div>

            {suiAddress ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5">
                  <span className="flex-1 font-mono text-sm text-white/60 truncate">{suiAddress}</span>
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
                    className="text-xs text-white/20 hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="flex items-center gap-4 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs uppercase tracking-wider text-white/30">SUI</span>
                    <span className={`font-mono text-xs font-medium ${suiBalances && suiBalances.sui > 0 ? 'text-green-400' : 'text-white/40'}`}>
                      {suiBalances ? suiBalances.sui.toFixed(4) : '—'}
                    </span>
                  </div>
                  <div className="h-3 w-px bg-white/10" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs uppercase tracking-wider text-white/30">IKA</span>
                    <span className={`font-mono text-xs font-medium ${suiBalances && suiBalances.ika > 0 ? 'text-purple-400' : 'text-white/40'}`}>
                      {suiBalances ? suiBalances.ika.toFixed(4) : '—'}
                    </span>
                  </div>
                  {(!suiBalances || (suiBalances.sui === 0 && suiBalances.ika === 0)) && (
                    <span className="ml-auto text-xs text-yellow-400/70">needs funding</span>
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
                      className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.05] hover:text-white transition-all"
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
                className="rounded-lg border border-yellow-500/30 bg-yellow-500/[0.08] px-3 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-500/[0.15] transition-all"
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
              <span className="font-mono text-sm text-green-400/60">{dwalletIdHex.slice(0, 12)}…</span>
              <button
                type="button"
                onClick={handleCreateDwallet}
                disabled={isCreatingDwallet}
                className="text-sm text-green-400/40 hover:text-green-400 hover:underline disabled:opacity-50 transition-colors"
              >
                {isCreatingDwallet ? 'Recreating…' : 'Recreate'}
              </button>
            </div>
          </div>
        )}

        {/* ── Register collateral ──────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-white/40">
            <div className="h-1 w-1 rounded-full bg-white/20" />
            {dwalletIdHex ? 'Register Collateral' : 'Step 2 — Register Collateral'}
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider font-medium text-white/40">Chain</label>
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
              <label className="block text-xs uppercase tracking-wider font-medium text-white/40">
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
              <label className="block text-xs uppercase tracking-wider font-medium text-white/40">
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
            <label className="block text-xs uppercase tracking-wider font-medium text-white/40">
              IKA Oracle Public Key
            </label>
            <input
              value={oracleKey}
              onChange={(e) => setOracleKey(e.target.value.trim())}
              placeholder="IKA oracle ed25519 pubkey (base58)"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
            {oracleKey === TEST_ORACLE_PUBKEY && (
              <p className="text-xs text-purple-400/60 px-1 italic">Using local test oracle</p>
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
