'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowRight, Banknote, LockKeyhole, ShieldCheck } from 'lucide-react';
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
    <div data-app-scroll className="relative flex-1 overflow-y-auto px-4 py-12 [overscroll-behavior:contain] sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1260px] gap-6 pb-12 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <section className="rounded-md border border-white/10 bg-black/35 p-6 shadow-[0_8px_24px_rgba(60,46,22,0.05)]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Borrower desk
              </span>
              <span className="rounded-full border border-[#2d72ff] bg-[#eaf1ff] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#1f62df]">
                IKA collateral
              </span>
            </div>
            <h1 className="font-display text-5xl leading-none tracking-tight text-white">Apply for structured credit</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/70">
              Request a USDC loan, register locked BTC or ETH collateral through IKA, and keep disbursement state visible from one workflow.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-black/35 font-mono text-xs text-white/40">1</span>
              <div>
                <h2 className="text-sm font-semibold text-white">Loan application</h2>
                <p className="text-xs text-white/50">Amount, maturity, and use of funds.</p>
              </div>
            </div>
            <LoanApplicationForm />
          </section>

          {showCollateral && (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2d72ff] bg-[#eaf1ff] font-mono text-xs text-[#1f62df]">2</span>
                <div>
                  <h2 className="text-sm font-semibold text-white">Lock collateral via IKA dWallet</h2>
                  <p className="text-xs text-white/50">Register and verify the collateral route before funding.</p>
                </div>
              </div>
              <CollateralOnboarding vaultId={VAULT_ID} loanId={application!.loanId!} />
            </section>
          )}

          {showCollateral && (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-black/35 font-mono text-xs text-white/35">3</span>
                <div>
                  <h2 className="text-sm font-semibold text-[#514b40]">Disbursement</h2>
                  <p className="text-xs text-white/50">Admin releases USDC after collateral is locked.</p>
                </div>
              </div>
              <div className="rounded-md border border-dashed border-white/10 bg-black/35 p-4 text-sm leading-6 text-white/50">
                Once IKA collateral is verified as locked, the admin can disburse USDC directly to your wallet.
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-5">
          <section className="rounded-md border border-white/10 bg-black/35 p-5 shadow-[0_8px_24px_rgba(60,46,22,0.05)]">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#2f7d4f]" />
              <h2 className="text-lg font-semibold text-white">Borrow flow</h2>
            </div>
            <div className="space-y-2">
              {[
                { icon: Banknote, title: 'Request USDC', copy: 'Submit amount, duration, and purpose.' },
                { icon: LockKeyhole, title: 'Attach collateral', copy: 'Lock BTC, ETH, or Sui collateral through IKA.' },
                { icon: ArrowRight, title: 'Receive funding', copy: 'Admin disburses after verification.' },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-white/40" />
                      <div className="text-sm font-semibold text-white">{step.title}</div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/50">{step.copy}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-[#ad7b21]/30 bg-[#f5eddd] p-4 text-sm leading-6 text-[#7a5a1a]">
            Collateral verification is intentionally separate from investor deposits, keeping borrower risk and tranche market decisions cleanly separated.
          </section>
        </aside>
      </div>
    </div>
  );
}
