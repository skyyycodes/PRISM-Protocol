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
  pending:  { label: 'Under Review', cls: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  approved: { label: 'Approved',     cls: 'bg-green-50 text-green-800 border-green-200' },
  rejected: { label: 'Rejected',     cls: 'bg-red-50 text-red-800 border-red-200' },
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
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Connect your Phantom wallet to apply for a loan.
      </div>
    );
  }

  if (existing) {
    const ui = STATUS_UI[existing.status];
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Loan Application</h3>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${ui.cls}`}>
            {ui.label}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Requested</dt>
          <dd className="font-medium text-slate-800">${Number(existing.requestedUSDC).toLocaleString()} USDC</dd>

          <dt className="text-slate-500">Maturity</dt>
          <dd className="text-slate-700">{existing.maturityDays} days</dd>

          <dt className="text-slate-500">Purpose</dt>
          <dd className="text-slate-700">{existing.purpose}</dd>

          {existing.approvedAprBps !== undefined && (
            <>
              <dt className="text-slate-500">APR</dt>
              <dd className="font-medium text-green-700">{(existing.approvedAprBps / 100).toFixed(2)}%</dd>
            </>
          )}

          {existing.loanId !== undefined && (
            <>
              <dt className="text-slate-500">Loan ID</dt>
              <dd className="font-mono text-slate-700">{existing.loanId}</dd>
            </>
          )}

          <dt className="text-slate-500">Submitted</dt>
          <dd className="text-slate-500 text-xs">{new Date(existing.submittedAt).toLocaleString()}</dd>
        </dl>

        {existing.status === 'pending' && (
          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
            Your application is under review. The admin will originate the loan on-chain once approved.
            Come back to attach IKA collateral after approval.
          </p>
        )}

        {existing.status === 'approved' && existing.loanId !== undefined && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800">
            Loan originated on-chain. Scroll down to attach IKA collateral to unlock disbursement.
          </div>
        )}

        {existing.status === 'rejected' && (
          <button
            onClick={() => {
              // Let them reapply by clearing the rejected state
              window.location.reload();
            }}
            className="text-xs text-slate-500 underline"
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">Apply for a Loan</h3>
        <p className="mt-1 text-xs text-slate-500">
          Submit your loan request. The admin reviews and originates on-chain.
          You will need to back it with IKA dWallet collateral before disbursement.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Loan Amount (USDC)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              type="number"
              min="1000"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>
          <p className="mt-0.5 text-xs text-slate-400">Min $1,000 — Max $500,000 USDC</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Loan Duration</label>
          <div className="grid grid-cols-4 gap-2">
            {MATURITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaturityDays(opt.value)}
                className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                  maturityDays === opt.value
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Purpose</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {PURPOSE_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-600">Collateral requirement</p>
          <p>You will need to back this loan with BTC or ETH locked in an IKA dWallet (≥ 150% LTV).
             The IKA oracle will verify the lock before the admin can disburse.</p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-100" />
          <span>Applying as</span>
          <div className="h-px flex-1 bg-slate-100" />
        </div>
        <p className="text-center font-mono text-xs text-slate-500 -mt-2">
          {publicKey.toBase58().slice(0, 20)}…
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Loan Application'}
        </button>
      </form>
    </div>
  );
}
