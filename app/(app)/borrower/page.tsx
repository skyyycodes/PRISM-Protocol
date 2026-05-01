'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { AppTopbar } from '@/components/app-shell/app-topbar';
import { LoanApplicationForm } from '@/components/borrower/LoanApplicationForm';
import { CollateralOnboarding } from '@/components/borrower/CollateralOnboarding';
import { useLoanApplications } from '@/hooks/useLoanApplications';
import { VAULT_ID } from '@/app/lib/constants';

export default function BorrowerPage() {
  const { publicKey } = useWallet();
  const { getByBorrower } = useLoanApplications();

  const application = publicKey ? getByBorrower(publicKey.toBase58()) : undefined;
  const showCollateral = application?.status === 'approved' && application.loanId !== undefined;

  return (
    <>
      <AppTopbar />
      <div className="relative flex-1 overflow-y-auto px-6 py-5 [overscroll-behavior:contain]">
        <div className="mx-auto max-w-lg space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Borrow</h1>
            <p className="mt-1 text-sm text-slate-500">
              Apply for a structured credit loan backed by your BTC or ETH via IKA dWallet collateral.
            </p>
          </div>

          {/* Step 1: Application */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">1</span>
              <span className="text-sm font-medium text-slate-700">Loan Application</span>
            </div>
            <LoanApplicationForm />
          </div>

          {/* Step 2: IKA Collateral (only shown after loan is approved + originated) */}
          {showCollateral && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">2</span>
                <span className="text-sm font-medium text-slate-700">Lock Collateral via IKA dWallet</span>
              </div>
              <CollateralOnboarding
                vaultId={VAULT_ID}
                loanId={application!.loanId!}
              />
            </div>
          )}

          {/* Step 3: Disbursement info */}
          {showCollateral && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400">3</span>
                <span className="text-sm font-medium text-slate-400">Disbursement (admin triggers)</span>
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400">
                Once your IKA collateral is verified (Locked), the admin disburses the USDC directly to your wallet.
                You will see the funds arrive in your wallet after disbursement.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
