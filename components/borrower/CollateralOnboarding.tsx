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

  // ── Attach form state ─────────────────────────────────────────────────────
  const [dwalletIdHex, setDwalletIdHex] = useState('');
  const [chainId, setChainId] = useState<IkaChain>(IKA_CHAIN.BTC);
  const [collateralUsd, setCollateralUsd] = useState('');
  const [oracleKey, setOracleKey] = useState('');
  const [isCreatingDwallet, setIsCreatingDwallet] = useState(false);
  const [suiSeedHex, setSuiSeedHex] = useState('');

  if (!connected) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Connect wallet to manage IKA collateral.
      </div>
    );
  }

  // ── If collateral already exists, show status panel ──────────────────────
  if (collateral) {
    const dwalletHex = Buffer.from(collateral.dwalletId).toString('hex');

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">IKA Collateral</h3>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[collateral.status] ?? ''}`}
          >
            {collateral.status}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">dWallet ID</dt>
          <dd className="font-mono text-slate-700 truncate" title={dwalletHex}>
            {dwalletHex.slice(0, 16)}…
          </dd>

          <dt className="text-slate-500">Chain</dt>
          <dd className="text-slate-700">{CHAIN_LABELS[collateral.chainId as IkaChain]}</dd>

          <dt className="text-slate-500">Collateral (USD)</dt>
          <dd className="text-slate-700">
            ${(Number(collateral.collateralAmountUsd) / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </dd>

          <dt className="text-slate-500">Oracle</dt>
          <dd className="font-mono text-slate-700 truncate" title={collateral.oraclePubkey.toBase58()}>
            {collateral.oraclePubkey.toBase58().slice(0, 12)}…
          </dd>

          {collateral.lockedTs > 0 && (
            <>
              <dt className="text-slate-500">Locked at</dt>
              <dd className="text-slate-700">
                {new Date(collateral.lockedTs * 1000).toLocaleString()}
              </dd>
            </>
          )}
        </dl>

        {/* Actions based on current status */}
        {collateral.status === 'Pending' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
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
              className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isPolling ? 'Polling IKA oracle…' : 'Verify Collateral Lock'}
            </button>
          </div>
        )}

        {collateral.status === 'Locked' && (
          <p className="text-xs text-green-700 bg-green-50 rounded-lg p-2">
            Collateral is locked. Your loan can now be disbursed by the admin.
          </p>
        )}

        {collateral.status === 'Locked' && (
          loanIsRepaid ? (
            <button
              disabled={releaseMutation.isPending}
              onClick={() => releaseMutation.mutate({ vaultId, loanId })}
              className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {releaseMutation.isPending ? 'Releasing…' : 'Release Collateral'}
            </button>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 border border-slate-200">
              Repay your loan in full before releasing collateral.
            </p>
          )
        )}

        {collateral.status === 'Released' && (
          <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2">
            Collateral released. IKA Network will unlock your BTC/ETH.
          </p>
        )}

        {collateral.status === 'Liquidated' && (
          <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2">
            Collateral has been liquidated due to loan default.
          </p>
        )}
      </div>
    );
  }

  // ── No collateral yet — show attach form ─────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400 animate-pulse">
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">Attach IKA Collateral</h3>
        <p className="mt-1 text-xs text-slate-500">
          Lock BTC or ETH in an IKA dWallet and register it here as loan collateral.
          The IKA oracle will attest the lock on-chain before disbursement.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Chain</label>
          <select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value) as IkaChain)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={IKA_CHAIN.BTC}>Bitcoin (BTC)</option>
            <option value={IKA_CHAIN.ETH}>Ethereum (ETH)</option>
            <option value={IKA_CHAIN.SUI}>Sui</option>
          </select>
        </div>

        {/* Create dWallet via IKA SDK */}
        <details className="rounded-lg border border-purple-100 bg-purple-50">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-purple-700 select-none">
            Create a new dWallet on IKA Network
          </summary>
          <div className="px-3 pb-3 pt-1 space-y-2">
            <p className="text-xs text-purple-600">
              Provide a 32-byte Sui keypair seed (hex). This keypair pays gas on IKA Network
              and will own the resulting dWallet.
              Requires SUI &amp; IKA tokens on the target network.
            </p>
            <input
              value={suiSeedHex}
              onChange={(e) => setSuiSeedHex(e.target.value.trim().toLowerCase())}
              placeholder="64 hex chars (32-byte Sui keypair seed)"
              className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              disabled={isCreatingDwallet}
              onClick={handleCreateDwallet}
              className="w-full rounded-lg bg-purple-100 px-3 py-2 text-xs font-medium text-purple-800 hover:bg-purple-200 disabled:opacity-50"
            >
              {isCreatingDwallet ? 'Running DKG on IKA Network…' : 'Create dWallet'}
            </button>
          </div>
        </details>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            dWallet ID (hex, 64 chars)
          </label>
          <input
            value={dwalletIdHex}
            onChange={(e) => setDwalletIdHex(e.target.value.trim().toLowerCase())}
            placeholder="a1b2c3d4… (auto-filled after Create, or paste from IKA dashboard)"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Collateral Value (USD)
          </label>
          <input
            type="number"
            min="0"
            value={collateralUsd}
            onChange={(e) => setCollateralUsd(e.target.value)}
            placeholder="50000"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            IKA Oracle Public Key
          </label>
          <input
            value={oracleKey}
            onChange={(e) => setOracleKey(e.target.value.trim())}
            placeholder="IKA oracle ed25519 pubkey (base58)"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="mt-0.5 text-xs text-slate-400">
            Devnet test oracle:{' '}
            <button
              type="button"
              className="font-mono text-purple-600 hover:underline"
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
        className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {attachMutation.isPending ? 'Registering…' : 'Register IKA Collateral'}
      </button>
    </div>
  );
}
