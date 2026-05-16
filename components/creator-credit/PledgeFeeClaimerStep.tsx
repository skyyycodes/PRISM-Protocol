'use client';

import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { ArrowRight, ShieldCheck, Clock } from 'lucide-react';

import { getBagsFeeClaimerPda, getVaultPda } from '@/app/lib/pda';
import { VAULT_ID } from '@/app/lib/constants';
import { formatUsdc } from '@/app/lib/bags-valuation';

interface Props {
  tokenMint: string;
  shareBps: number;
  creatorWallet: string;
  maxLoanUsdcBase: bigint;
}

/**
 * Final step of the creator-credit wizard.
 *
 * The button is intentionally non-functional in the scaffold — wiring it
 * requires the borrower to (a) initialize a loan with `initialize_loan`,
 * (b) update their Bags token's fee-share config to add the PRISM fee-claimer
 * PDA as a recipient, and (c) sign an `accept_bags_fee_collateral` tx that
 * carries the Bags oracle attestation. That orchestration is Tier B work —
 * see docs/bags-hackathon-strategy.md.
 */
export function PledgeFeeClaimerStep({
  tokenMint,
  shareBps,
  creatorWallet,
  maxLoanUsdcBase,
}: Props) {
  const claimerPda = useMemo(() => {
    try {
      const [vault] = getVaultPda(VAULT_ID);
      const [pda] = getBagsFeeClaimerPda(vault, new PublicKey(creatorWallet));
      return pda.toBase58();
    } catch {
      return null;
    }
  }, [creatorWallet]);

  return (
    <div className="rounded-xl border border-white/[0.10] bg-white/[0.03] p-5 backdrop-blur-md">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
        Step 2 — Pledge fee claimer
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Token mint" mono>
          {tokenMint.slice(0, 4)}…{tokenMint.slice(-4)}
        </Field>
        <Field label="Share routed" mono>
          {(shareBps / 100).toFixed(0)}%
        </Field>
        <Field label="USDC available" mono>
          ${formatUsdc(maxLoanUsdcBase)}
        </Field>
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.08] bg-black/30 p-4">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/40">
          <ShieldCheck className="h-3 w-3" />
          PRISM fee-claimer PDA
        </div>
        <p className="break-all font-mono text-[11px] text-white/70">
          {claimerPda ?? 'derive failed'}
        </p>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/40">
          Assign this address as a fee claimer on your Bags token&apos;s
          fee-share config with{' '}
          <span className="text-white/65">{shareBps} bps</span>. The protocol
          claims the routed SOL fees and applies them as USDC repayments to
          your loan.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-amber-300/80">
          <Clock className="h-3 w-3" />
          Tier B Anchor instructions pending wiring (scaffold)
        </div>
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40"
          title="accept_bags_fee_collateral wiring is the next milestone"
        >
          Pledge &amp; borrow
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
      <p className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className={`text-sm tabular-nums text-white/85 ${mono ? 'font-mono' : ''}`}>
        {children}
      </p>
    </div>
  );
}
