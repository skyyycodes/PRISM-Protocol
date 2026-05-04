'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useLoanApplications, type LoanApplication } from '@/hooks/useLoanApplications';

interface Props {
  onSubmitted?: () => void;
}

const MATURITY_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
  { label: '180 days', value: 180 },
];

const PURPOSE_OPTIONS = [
  'Working capital',
  'Inventory purchase',
  'Equipment financing',
  'Trade finance',
  'Real estate bridge',
  'Other',
];

const STATUS_UI: Record<LoanApplication['status'], { label: string; cls: string }> = {
  pending:  { label: 'Under Review', cls: 'border-[#ad7b21]/50 bg-[#ad7b21]/10 text-[#f0c06a]' },
  approved: { label: 'Approved',     cls: 'border-[#16a34a]/60 bg-[#16a34a]/10 text-[#86efac]' },
  rejected: { label: 'Rejected',     cls: 'border-pink-500/45 bg-pink-500/10 text-pink-200' },
};

export function LoanApplicationForm({ onSubmitted }: Props) {
  const { publicKey, connected } = useWallet();
  const { submit, getByBorrower } = useLoanApplications();

  const existing = publicKey ? getByBorrower(publicKey.toBase58()) : undefined;

  const [amount, setAmount] = useState('10000');
  const [maturityDays, setMaturityDays] = useState(90);
  const [purpose, setPurpose] = useState('Working capital');
  const [submitting, setSubmitting] = useState(false);

  if (!connected || !publicKey) {
    return (
      <div className="rounded-md border border-dashed border-white/25 bg-black/20 p-6 text-center text-sm text-white/45">
        Connect your wallet to apply for a loan.
      </div>
    );
  }

  if (existing) {
    const ui = STATUS_UI[existing.status];
    return (
      <div className="space-y-4 rounded-md border border-white/10 bg-black/35 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Loan Application</h3>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${ui.cls}`}>
            {ui.label}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-white/45">Requested</dt>
          <dd className="font-medium text-white">${Number(existing.requestedUSDC).toLocaleString()} USDC</dd>

          <dt className="text-white/45">Maturity</dt>
          <dd className="text-white/70">{existing.maturityDays} days</dd>

          <dt className="text-white/45">Purpose</dt>
          <dd className="text-white/70">{existing.purpose}</dd>

          {existing.approvedAprBps !== undefined && (
            <>
              <dt className="text-white/45">APR</dt>
              <dd className="font-medium text-[#86efac]">{(existing.approvedAprBps / 100).toFixed(2)}%</dd>
            </>
          )}

          {existing.loanId !== undefined && (
            <>
              <dt className="text-white/45">Loan ID</dt>
              <dd className="font-mono text-white/70">{existing.loanId}</dd>
            </>
          )}

          <dt className="text-white/45">Submitted</dt>
          <dd className="text-xs text-white/45">{new Date(existing.submittedAt).toLocaleString()}</dd>
        </dl>

        {existing.status === 'pending' && (
          <p className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-xs text-white/45">
            Your application is under review. The admin will originate the loan on-chain once approved.
            Come back to attach IKA collateral after approval.
          </p>
        )}

        {existing.status === 'approved' && existing.loanId !== undefined && (
          <div className="rounded-md border border-[#16a34a]/45 bg-[#16a34a]/10 p-3 text-xs text-[#86efac]">
            Loan originated on-chain. Scroll down to attach IKA collateral to unlock disbursement.
          </div>
        )}

        {existing.status === 'rejected' && (
          <button
            onClick={() => {
              // Let them reapply by clearing the rejected state
              window.location.reload();
            }}
            className="text-xs text-white/50 underline transition-colors hover:text-white"
          >
            Apply again
          </button>
        )}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const usd = parseFloat(amount);
    if (isNaN(usd) || usd < 1000) {
      toast.error('Minimum loan amount is $1,000 USDC');
      return;
    }
    setSubmitting(true);
    try {
      submit({
        borrowerPubkey: publicKey!.toBase58(),
        requestedUSDC: usd,
        maturityDays,
        purpose,
      });
      toast.success('Application submitted! The admin will review shortly.');
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-md border border-white/10 bg-black/35 p-5">
      <div>
        <h3 className="font-semibold text-white">Apply for a Loan</h3>
        <p className="mt-1 text-xs text-white/50">
          Submit your loan request. The admin reviews and originates on-chain.
          You will need to back it with IKA dWallet collateral before disbursement.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-white/55">
            Loan Amount (USDC)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/35">$</span>
            <input
              type="number"
              min="1000"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/40 py-2 pl-7 pr-3 text-sm text-white outline-none transition-colors focus:border-pink-500/40"
              required
            />
          </div>
          <p className="mt-0.5 text-xs text-white/35">Min $1,000 — Max $500,000 USDC</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/55">Loan Duration</label>
          <div className="grid grid-cols-4 gap-2">
            {MATURITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaturityDays(opt.value)}
                className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                  maturityDays === opt.value
                    ? 'border-pink-500/60 bg-pink-500/15 text-pink-100'
                    : 'border-white/10 text-white/55 hover:border-white/25 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/55">Purpose</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-pink-500/40"
          >
            {PURPOSE_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 rounded-md border border-[#2d72ff]/30 bg-[#2d72ff]/10 p-3 text-xs text-white/55">
          <p className="font-medium text-[#9ec0ff]">Collateral requirement</p>
          <p>You will need to back this loan with BTC or ETH locked in an IKA dWallet (≥ 150% LTV).
             The IKA oracle will verify the lock before the admin can disburse.</p>
        </div>

        <div className="flex items-center gap-3 text-xs text-white/35">
          <div className="h-px flex-1 bg-white/10" />
          <span>Applying as</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <p className="-mt-2 text-center font-mono text-xs text-white/45">
          {publicKey.toBase58().slice(0, 20)}…
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/85 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Loan Application'}
        </button>
      </form>
    </div>
  );
}
