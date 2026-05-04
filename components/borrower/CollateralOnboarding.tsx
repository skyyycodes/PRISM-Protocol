'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toast } from 'sonner';

import { IKA_CHAIN, IkaChain, createIkaDwallet } from '@/app/lib/ika';
import {
  useIkaCollateralAccount,
  useAttachIkaCollateral,
  useVerifyIkaCollateral,
  useReleaseIkaCollateral,
  useLoanAccount,
} from '@/hooks/useIkaCollateral';
import { getVaultPda, getLoanPda } from '@/app/lib/pda';

const CHAIN_LABELS: Record<IkaChain, string> = {
  [IKA_CHAIN.BTC]: 'Bitcoin',
  [IKA_CHAIN.ETH]: 'Ethereum',
  [IKA_CHAIN.SUI]: 'Sui',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'border-[#ad7b21]/50 bg-[#ad7b21]/10 text-[#f0c06a]',
  Locked: 'border-[#16a34a]/60 bg-[#16a34a]/10 text-[#86efac]',
  Released: 'border-[#2d72ff]/50 bg-[#2d72ff]/10 text-[#9ec0ff]',
  Liquidated: 'border-pink-500/45 bg-pink-500/10 text-pink-200',
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

  // ── Attach form state ─────────────────────────────────────────────────────
  const [dwalletIdHex, setDwalletIdHex] = useState('');
  const [chainId, setChainId] = useState<IkaChain>(IKA_CHAIN.BTC);
  const [collateralUsd, setCollateralUsd] = useState('');
  const [oracleKey, setOracleKey] = useState('');
  const [isCreatingDwallet, setIsCreatingDwallet] = useState(false);
  const [suiSeedHex, setSuiSeedHex] = useState('');

  if (!connected) {
    return (
      <div className="rounded-md border border-dashed border-white/25 bg-black/20 p-6 text-center text-sm text-white/45">
        Connect wallet to manage IKA collateral.
      </div>
    );
  }

  // ── If collateral already exists, show status panel ──────────────────────
  if (collateral) {
    const dwalletHex = Buffer.from(collateral.dwalletId).toString('hex');

    return (
      <div className="space-y-4 rounded-md border border-white/10 bg-black/35 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">IKA Collateral</h3>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[collateral.status] ?? ''}`}
          >
            {collateral.status}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-white/45">dWallet ID</dt>
          <dd className="truncate font-mono text-white/70" title={dwalletHex}>
            {dwalletHex.slice(0, 16)}…
          </dd>

          <dt className="text-white/45">Chain</dt>
          <dd className="text-white/70">{CHAIN_LABELS[collateral.chainId as IkaChain]}</dd>

          <dt className="text-white/45">Collateral (USD)</dt>
          <dd className="text-white/70">
            ${(Number(collateral.collateralAmountUsd) / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </dd>

          <dt className="text-white/45">Oracle</dt>
          <dd className="truncate font-mono text-white/70" title={collateral.oraclePubkey.toBase58()}>
            {collateral.oraclePubkey.toBase58().slice(0, 12)}…
          </dd>

          {collateral.lockedTs > 0 && (
            <>
              <dt className="text-white/45">Locked at</dt>
              <dd className="text-white/70">
                {new Date(collateral.lockedTs * 1000).toLocaleString()}
              </dd>
            </>
          )}
        </dl>

        {/* Actions based on current status */}
        {collateral.status === 'Pending' && (
          <div className="space-y-2">
            <p className="text-xs text-white/50">
              Waiting for IKA oracle to confirm your on-chain lock.
              Click Verify once your BTC/ETH transaction is confirmed.
            </p>
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
              className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-50"
            >
              {isPolling ? 'Polling IKA oracle…' : 'Verify Collateral Lock'}
            </button>
          </div>
        )}

        {collateral.status === 'Locked' && (
          <p className="rounded-md border border-[#16a34a]/45 bg-[#16a34a]/10 p-2 text-xs text-[#86efac]">
            Collateral is locked. Your loan can now be disbursed by the admin.
          </p>
        )}

        {collateral.status === 'Locked' && (
          loanIsRepaid ? (
            <button
              disabled={releaseMutation.isPending}
              onClick={() => releaseMutation.mutate({ vaultId, loanId })}
              className="w-full rounded-md border border-[#2d72ff]/50 bg-[#2d72ff]/10 px-4 py-2 text-sm font-medium text-[#9ec0ff] transition-colors hover:bg-[#2d72ff]/15 disabled:opacity-50"
            >
              {releaseMutation.isPending ? 'Releasing…' : 'Release Collateral'}
            </button>
          ) : (
            <p className="rounded-md border border-white/10 bg-white/[0.04] p-2 text-xs text-white/50">
              Repay your loan in full before releasing collateral.
            </p>
          )
        )}

        {collateral.status === 'Released' && (
          <p className="rounded-md border border-[#2d72ff]/45 bg-[#2d72ff]/10 p-2 text-xs text-[#9ec0ff]">
            Collateral released. IKA Network will unlock your BTC/ETH.
          </p>
        )}

        {collateral.status === 'Liquidated' && (
          <p className="rounded-md border border-pink-500/45 bg-pink-500/10 p-2 text-xs text-pink-200">
            Collateral has been liquidated due to loan default.
          </p>
        )}
      </div>
    );
  }

  // ── No collateral yet — show attach form ─────────────────────────────────
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-md border border-white/10 bg-black/35 p-5 text-sm text-white/45">
        Loading collateral status…
      </div>
    );
  }

  async function handleCreateDwallet() {
    if (!suiSeedHex || suiSeedHex.length < 64) {
      toast.error('Sui seed must be at least 64 hex chars (32 bytes)');
      return;
    }
    setIsCreatingDwallet(true);
    try {
      const seed = Buffer.from(suiSeedHex.slice(0, 64), 'hex');
      const keypair = Ed25519Keypair.fromSecretKey(seed);
      const entropy = new Uint8Array(32);
      crypto.getRandomValues(entropy);
      const info = await createIkaDwallet(keypair, entropy);
      setDwalletIdHex(Buffer.from(info.dwalletId).toString('hex'));
      toast.success(`dWallet created: ${info.dwalletObjectId.slice(0, 20)}…`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'dWallet creation failed');
    } finally {
      setIsCreatingDwallet(false);
    }
  }

  function handleAttach() {
    if (!dwalletIdHex || dwalletIdHex.length !== 64) {
      toast.error('dWallet ID must be 64 hex characters (32 bytes)');
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

  return (
    <div className="space-y-4 rounded-md border border-white/10 bg-black/35 p-5">
      <div>
        <h3 className="font-semibold text-white">Attach IKA Collateral</h3>
        <p className="mt-1 text-xs text-white/50">
          Lock BTC or ETH in an IKA dWallet and register it here as loan collateral.
          The IKA oracle will attest the lock on-chain before disbursement.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-white/55">Chain</label>
          <select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value) as IkaChain)}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-pink-500/40"
          >
            <option value={IKA_CHAIN.BTC}>Bitcoin (BTC)</option>
            <option value={IKA_CHAIN.ETH}>Ethereum (ETH)</option>
            <option value={IKA_CHAIN.SUI}>Sui</option>
          </select>
        </div>

        {/* Create dWallet via IKA SDK */}
        <details className="rounded-md border border-pink-500/25 bg-pink-500/[0.06]">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-pink-100">
            Create a new dWallet on IKA Network
          </summary>
          <div className="space-y-2 px-3 pb-3 pt-1">
            <p className="text-xs text-white/55">
              Provide a 32-byte Sui keypair seed (hex). This keypair pays gas on IKA Network
              and will own the resulting dWallet.
              Requires SUI &amp; IKA tokens on the target network.
            </p>
            <input
              value={suiSeedHex}
              onChange={(e) => setSuiSeedHex(e.target.value.trim().toLowerCase())}
              placeholder="64 hex chars (32-byte Sui keypair seed)"
              className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none transition-colors placeholder:text-white/30 focus:border-pink-500/40"
            />
            <button
              disabled={isCreatingDwallet}
              onClick={handleCreateDwallet}
              className="w-full rounded-md border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-medium text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
            >
              {isCreatingDwallet ? 'Running DKG on IKA Network…' : 'Create dWallet'}
            </button>
          </div>
        </details>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/55">
            dWallet ID (hex, 64 chars)
          </label>
          <input
            value={dwalletIdHex}
            onChange={(e) => setDwalletIdHex(e.target.value.trim().toLowerCase())}
            placeholder="a1b2c3d4… (auto-filled after Create, or paste from IKA dashboard)"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none transition-colors placeholder:text-white/30 focus:border-pink-500/40"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/55">
            Collateral Value (USD)
          </label>
          <input
            type="number"
            min="0"
            value={collateralUsd}
            onChange={(e) => setCollateralUsd(e.target.value)}
            placeholder="50000"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-pink-500/40"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/55">
            IKA Oracle Public Key
          </label>
          <input
            value={oracleKey}
            onChange={(e) => setOracleKey(e.target.value.trim())}
            placeholder="IKA oracle ed25519 pubkey (base58)"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none transition-colors placeholder:text-white/30 focus:border-pink-500/40"
          />
          <p className="mt-0.5 text-xs text-white/35">
            Devnet test oracle:{' '}
            <button
              type="button"
              className="font-mono text-pink-200 hover:underline"
              onClick={() => setOracleKey('5nmEq5cNc9yXpK1ySrb4XH65zccBvRK2hwKnEJePjcrf')}
            >
              5nmEq5cNc9yXp…
            </button>
            {' '}(click to fill)
          </p>
        </div>
      </div>

      <button
        disabled={attachMutation.isPending}
        onClick={handleAttach}
        className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-50"
      >
        {attachMutation.isPending ? 'Registering…' : 'Register IKA Collateral'}
      </button>
    </div>
  );
}
