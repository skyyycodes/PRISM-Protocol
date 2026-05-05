'use client';

import { BN } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { useConnection } from '@solana/wallet-adapter-react';
import { Keypair, SYSVAR_RENT_PUBKEY, SystemProgram } from '@solana/web3.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  Flame,
  Info,
  Landmark,
  Play,
  RotateCcw,
  ShieldAlert,
  TrendingDown,
  WalletCards,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  DEFAULT_DEMO_LOAN_PRINCIPAL,
  DEFAULT_DEMO_LOSS_AMOUNT,
  DEFAULT_DEMO_YIELD_AMOUNT,
  TRANCHE_CONFIG,
  TrancheKind,
  USDC_MINT,
  VAULT_ID,
} from '@/app/lib/constants';
import { delta, formatNavQ, formatUsdc, parseUsdc, toBigInt } from '@/app/lib/format';
import {
  getConfigPda,
  getCreditEventPda,
  getLoanPda,
  getLossBucketPda,
  getLpMintPda,
  getPoolPda,
  getPoolQuoteReservePda,
  getPoolTrancheReservePda,
  getTrancheMintPda,
  getTranchePda,
  getVaultPda,
  getVaultReservePda,
} from '@/app/lib/pda';
import { buildPrograms } from '@/app/lib/program';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import mmSecret from '@/contracts/keys/mm.json';
import { useIdentity } from '@/hooks/useIdentity';
import { useSimulationActions } from '@/hooks/useSimulationActions';
import { useSimulationLog } from '@/hooks/useSimulationLog';
import { useVaultState } from '@/hooks/useVaultState';

function bn(value: bigint) {
  return new BN(value.toString());
}

function mmKeypair() {
  return Keypair.fromSecretKey(Uint8Array.from(mmSecret as number[]));
}

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-white/40 transition-colors hover:text-white/80" aria-label="More info">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] bg-black/95 text-xs leading-5 text-white/85 ring-1 ring-white/10">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('InsufficientLiquidity') || message.includes('InsufficientReserve')) {
    return 'Vault reserve is insufficient for this withdrawal. Use the AMM emergency exit path for immediate liquidity at market price.';
  }
  if (message.includes('SlippageExceeded')) {
    return 'AMM slippage protection rejected the transaction.';
  }
  if (message.includes('User rejected')) {
    return 'Transaction was rejected by the signer.';
  }
  return message.slice(0, 280);
}

export function ActionPanel() {
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const identity = useIdentity();
  const { addEntry } = useSimulationLog();
  const { registerActions } = useSimulationActions();
  const vaultState = useVaultState();
  const searchParams = useSearchParams();
  const trancheParam = searchParams?.get('tranche');

  useEffect(() => {
    if (trancheParam === 'prime') identity.setRole('senior');
    else if (trancheParam === 'alpha') identity.setRole('junior');
    else if (trancheParam === 'core') identity.setRole('senior');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trancheParam]);
  const [depositAmount, setDepositAmount] = useState('100.000000');
  const [withdrawShares, setWithdrawShares] = useState('1.000000');
  const [yieldAmount, setYieldAmount] = useState(formatUsdc(DEFAULT_DEMO_YIELD_AMOUNT));
  const [lossAmount, setLossAmount] = useState(formatUsdc(DEFAULT_DEMO_LOSS_AMOUNT));
  const [loanAmount, setLoanAmount] = useState('10.000000');
  const [swapAmount, setSwapAmount] = useState('10.000000');

  const investorTranche =
    identity.role === 'senior'
      ? TrancheKind.Prime
      : identity.role === 'junior'
        ? TrancheKind.Alpha
        : TrancheKind.Prime;

  const investorTrancheConfig = TRANCHE_CONFIG[investorTranche];

  const common = useMemo(() => {
    const { core, amm } = buildPrograms(connection, identity.keypair);
    const [config] = getConfigPda(core.programId);
    const [vault] = getVaultPda(VAULT_ID, core.programId);
    const [reserve] = getVaultReservePda(vault, core.programId);
    const [lossBucket] = getLossBucketPda(vault, core.programId);
    const [loan] = getLoanPda(vault, 0, core.programId);
    return { core, amm, config, vault, reserve, lossBucket, loan };
  }, [connection, identity.keypair]);

  async function tokenBalance(address: Awaited<ReturnType<typeof getAssociatedTokenAddress>>) {
    try {
      const balance = await connection.getTokenAccountBalance(address);
      return BigInt(balance.value.amount);
    } catch {
      return 0n;
    }
  }

  async function navSnapshot() {
    const programs = buildPrograms(connection, identity.keypair);
    const [vault] = getVaultPda(VAULT_ID, programs.core.programId);
    const parts = await Promise.all(
      ([TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const).map(async (kind) => {
        const [pda] = getTranchePda(vault, kind, programs.core.programId);
        const account = await programs.core.account.tranche.fetchNullable(pda);
        return `${TRANCHE_CONFIG[kind].label} NAV ${formatNavQ(account?.navPerShareQ ?? 0)}`;
      }),
    );
    return parts.join(' | ');
  }

  async function snapshot(signer: Keypair, kind: TrancheKind) {
    const data = vaultState.data;
    const usdcMint = data?.usdcMint ?? USDC_MINT;
    const [vault] = getVaultPda(VAULT_ID, common.core.programId);
    const [mint] = getTrancheMintPda(vault, kind, common.core.programId);
    const userUsdcAta = await getAssociatedTokenAddress(usdcMint, signer.publicKey);
    const userTrancheAta = await getAssociatedTokenAddress(mint, signer.publicKey);
    const [poolTrancheReserve] = getPoolTrancheReservePda(mint, common.amm.programId);
    const [poolQuoteReserve] = getPoolQuoteReservePda(mint, common.amm.programId);
    return {
      walletUsdc: await tokenBalance(userUsdcAta),
      trancheShares: await tokenBalance(userTrancheAta),
      vaultReserve: await tokenBalance(common.reserve),
      lossBucket: await tokenBalance(common.lossBucket),
      ammTranche: await tokenBalance(poolTrancheReserve),
      ammQuote: await tokenBalance(poolQuoteReserve),
    };
  }

  function recordSuccess(
    action: string,
    role: string,
    before: Awaited<ReturnType<typeof snapshot>>,
    after: Awaited<ReturnType<typeof snapshot>>,
    nav: string,
    signature: string,
  ) {
    addEntry({
      action,
      role,
      signature,
      status: 'success',
      navSnapshot: nav,
      deltas: {
        'Wallet USDC': delta(before.walletUsdc, after.walletUsdc),
        'Tranche Shares': delta(before.trancheShares, after.trancheShares),
        'Vault Reserve': delta(before.vaultReserve, after.vaultReserve),
        'Loss Bucket': delta(before.lossBucket, after.lossBucket),
        'AMM Tranche Reserve': delta(before.ammTranche, after.ammTranche),
        'AMM Quote Reserve': delta(before.ammQuote, after.ammQuote),
      },
    });
  }

  async function afterMutation() {
    await queryClient.invalidateQueries({ queryKey: ['vault-state'] });
  }

  const deposit = useMutation({
    mutationFn: async () => {
      const amount = parseUsdc(depositAmount);
      const before = await snapshot(identity.keypair, investorTranche);
      const usdcMint = vaultState.data?.usdcMint ?? USDC_MINT;
      const [tranche] = getTranchePda(common.vault, investorTranche, common.core.programId);
      const [mint] = getTrancheMintPda(common.vault, investorTranche, common.core.programId);
      const userUsdcAta = await getAssociatedTokenAddress(usdcMint, identity.keypair.publicKey);
      const userTrancheAta = await getAssociatedTokenAddress(mint, identity.keypair.publicKey);

      const accountsToCheck = {
        user: identity.keypair.publicKey,
        config: common.config,
        vault: common.vault,
        tranche,
        trancheMint: mint,
        userUsdcAta,
        vaultUsdcReserve: common.reserve,
        userTrancheAta,
      };
      console.group('[deposit] preflight');
      console.log('VAULT_ID', VAULT_ID);
      console.log('investorTranche kind', investorTranche, '(0=Prime,1=Core,2=Alpha)');
      console.log('amount (micro-USDC)', amount.toString());
      console.log('usdcMint (effective)', usdcMint.toBase58());
      console.log('USDC_MINT (constant)', USDC_MINT.toBase58());
      console.log('signer pubkey', identity.keypair.publicKey.toBase58());
      console.log('core programId', common.core.programId.toBase58());
      for (const [k, v] of Object.entries(accountsToCheck)) {
        console.log(' ', k, v.toBase58());
      }
      const infos = await connection.getMultipleAccountsInfo(Object.values(accountsToCheck));
      Object.keys(accountsToCheck).forEach((k, i) => {
        const info = infos[i];
        console.log(
          ` exists? ${k}=`,
          info ? `YES owner=${info.owner.toBase58()} dataLen=${info.data.length}` : 'NO',
        );
      });
      console.groupEnd();

      const signature = await common.core.methods
        .deposit(investorTranche, bn(amount))
        .accounts({
          ...accountsToCheck,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([identity.keypair])
        .rpc({ commitment: 'confirmed' })
        .catch((err: unknown) => {
          console.error('[deposit] rpc error', err);
          if (err && typeof err === 'object' && 'logs' in err) {
            console.error('[deposit] tx logs', (err as { logs?: string[] }).logs);
          }
          throw err;
        });
      const after = await snapshot(identity.keypair, investorTranche);
      recordSuccess(
        `${identity.label} Deposit (${formatUsdc(amount)} USDC -> ${investorTrancheConfig.label})`,
        identity.label,
        before,
        after,
        await navSnapshot(),
        signature,
      );
    },
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      const shares = parseUsdc(withdrawShares);
      const before = await snapshot(identity.keypair, investorTranche);
      const usdcMint = vaultState.data?.usdcMint ?? USDC_MINT;
      const [tranche] = getTranchePda(common.vault, investorTranche, common.core.programId);
      const [mint] = getTrancheMintPda(common.vault, investorTranche, common.core.programId);
      const signature = await common.core.methods
        .withdraw(investorTranche, bn(shares))
        .accounts({
          user: identity.keypair.publicKey,
          config: common.config,
          vault: common.vault,
          tranche,
          trancheMint: mint,
          userUsdcAta: await getAssociatedTokenAddress(usdcMint, identity.keypair.publicKey),
          vaultUsdcReserve: common.reserve,
          userTrancheAta: await getAssociatedTokenAddress(mint, identity.keypair.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([identity.keypair])
        .rpc({ commitment: 'confirmed' });
      const after = await snapshot(identity.keypair, investorTranche);
      recordSuccess(
        `${identity.label} Withdraw (${formatUsdc(shares)} ${investorTrancheConfig.label} shares)`,
        identity.label,
        before,
        after,
        await navSnapshot(),
        signature,
      );
    },
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  const accrueYield = useMutation({
    mutationFn: async () => {
      const amount = parseUsdc(yieldAmount);
      const admin = identity.identities.admin.keypair;
      const borrower = identity.identities.borrower.keypair;
      const programs = buildPrograms(connection, admin);
      const before = await snapshot(borrower, TrancheKind.Prime);
      const signature = await programs.core.methods
        .accrueYield(bn(amount))
        .accounts({
          authority: admin.publicKey,
          config: common.config,
          vault: common.vault,
          tranchePrime: getTranchePda(common.vault, TrancheKind.Prime, programs.core.programId)[0],
          trancheCore: getTranchePda(common.vault, TrancheKind.Core, programs.core.programId)[0],
          trancheAlpha: getTranchePda(common.vault, TrancheKind.Alpha, programs.core.programId)[0],
          vaultUsdcReserve: common.reserve,
          borrower: borrower.publicKey,
          borrowerUsdcAta: await getAssociatedTokenAddress(vaultState.data?.usdcMint ?? USDC_MINT, borrower.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([admin, borrower])
        .rpc({ commitment: 'confirmed' });
      const after = await snapshot(borrower, TrancheKind.Prime);
      recordSuccess('Admin Accrue Yield', 'Protocol Admin', before, after, await navSnapshot(), signature);
    },
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  const triggerDefault = useMutation({
    mutationFn: async () => {
      const amount = parseUsdc(lossAmount);
      const admin = identity.identities.admin.keypair;
      const programs = buildPrograms(connection, admin);
      const before = await snapshot(admin, TrancheKind.Alpha);
      const seq = Number(toBigInt(vaultState.data?.vault?.creditEventSeq ?? 0));
      const signature = await programs.core.methods
        .triggerCreditEvent(0, bn(amount), 5000)
        .accounts({
          authority: admin.publicKey,
          config: common.config,
          vault: common.vault,
          tranchePrime: getTranchePda(common.vault, TrancheKind.Prime, programs.core.programId)[0],
          trancheCore: getTranchePda(common.vault, TrancheKind.Core, programs.core.programId)[0],
          trancheAlpha: getTranchePda(common.vault, TrancheKind.Alpha, programs.core.programId)[0],
          vaultUsdcReserve: common.reserve,
          lossBucket: common.lossBucket,
          creditEvent: getCreditEventPda(common.vault, seq, programs.core.programId)[0],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc({ commitment: 'confirmed' });
      const after = await snapshot(admin, TrancheKind.Alpha);
      recordSuccess('Admin Trigger Default (50% demo severity)', 'Protocol Admin', before, after, await navSnapshot(), signature);
    },
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  async function sellOnAmm(signer: Keypair, kind: TrancheKind, amount: bigint, label: string) {
    const programs = buildPrograms(connection, signer);
    const before = await snapshot(signer, kind);
    const [mint] = getTrancheMintPda(common.vault, kind, programs.core.programId);
    const signature = await programs.amm.methods
      .swap(bn(amount), new BN(0), 0)
      .accounts({
        user: signer.publicKey,
        pool: getPoolPda(mint, programs.amm.programId)[0],
        trancheReserve: getPoolTrancheReservePda(mint, programs.amm.programId)[0],
        quoteReserve: getPoolQuoteReservePda(mint, programs.amm.programId)[0],
        userTrancheAta: await getAssociatedTokenAddress(mint, signer.publicKey),
        userQuoteAta: await getAssociatedTokenAddress(vaultState.data?.usdcMint ?? USDC_MINT, signer.publicKey),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc({ commitment: 'confirmed' });
    const after = await snapshot(signer, kind);
    recordSuccess(label, signer.publicKey.toBase58(), before, after, await navSnapshot(), signature);
  }

  const emergencySell = useMutation({
    mutationFn: async () => sellOnAmm(identity.keypair, investorTranche, parseUsdc(swapAmount), `${identity.label} AMM Emergency Exit`),
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  const marketReaction = useMutation({
    mutationFn: async () => {
      const mm = mmKeypair();
      for (let i = 0; i < 5; i += 1) {
        await sellOnAmm(mm, TrancheKind.Alpha, 400_000_000n, `Market Reaction pALPHA sell ${i + 1}/5`);
      }
      for (let i = 0; i < 2; i += 1) {
        await sellOnAmm(mm, TrancheKind.Core, 250_000_000n, `Market Reaction pCORE sell ${i + 1}/2`);
      }
    },
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  const disburse = useMutation({
    mutationFn: async () => {
      const admin = identity.identities.admin.keypair;
      const borrower = identity.identities.borrower.keypair;
      const programs = buildPrograms(connection, admin);
      const before = await snapshot(borrower, TrancheKind.Prime);
      const signature = await programs.core.methods
        .disburseLoan()
        .accounts({
          admin: admin.publicKey,
          config: common.config,
          vault: common.vault,
          loan: common.loan,
          vaultUsdcReserve: common.reserve,
          borrowerUsdcAta: await getAssociatedTokenAddress(vaultState.data?.usdcMint ?? USDC_MINT, borrower.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([admin])
        .rpc({ commitment: 'confirmed' });
      const after = await snapshot(borrower, TrancheKind.Prime);
      recordSuccess('Borrower Disbursement (admin-authorized)', 'Borrower', before, after, await navSnapshot(), signature);
    },
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  const repay = useMutation({
    mutationFn: async () => {
      const borrower = identity.identities.borrower.keypair;
      const programs = buildPrograms(connection, borrower);
      const amount = parseUsdc(loanAmount);
      const before = await snapshot(borrower, TrancheKind.Prime);
      const signature = await programs.core.methods
        .repayLoan(bn(amount))
        .accounts({
          borrower: borrower.publicKey,
          config: common.config,
          vault: common.vault,
          loan: common.loan,
          borrowerUsdcAta: await getAssociatedTokenAddress(vaultState.data?.usdcMint ?? USDC_MINT, borrower.publicKey),
          vaultUsdcReserve: common.reserve,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([borrower])
        .rpc({ commitment: 'confirmed' });
      const after = await snapshot(borrower, TrancheKind.Prime);
      recordSuccess('Borrower Repay Loan', 'Borrower', before, after, await navSnapshot(), signature);
    },
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  const initialize = useMutation({
    mutationFn: async () => {
      const admin = identity.identities.admin.keypair;
      const programs = buildPrograms(connection, admin);
      const [config] = getConfigPda(programs.core.programId);
      const [vault] = getVaultPda(VAULT_ID, programs.core.programId);
      const [reserve] = getVaultReservePda(vault, programs.core.programId);
      const [lossBucket] = getLossBucketPda(vault, programs.core.programId);
      const [loan] = getLoanPda(vault, 0, programs.core.programId);

      if (!(await programs.core.account.globalConfig.fetchNullable(config))) {
        await programs.core.methods
          .initializeGlobalConfig(0, [identity.identities.borrower.keypair.publicKey])
          .accounts({
            admin: admin.publicKey,
            config,
            usdcMint: vaultState.data?.usdcMint ?? USDC_MINT,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
      }

      if (!(await programs.core.account.vault.fetchNullable(vault))) {
        await programs.core.methods
          .initializeVault(VAULT_ID)
          .accounts({ admin: admin.publicKey, config, vault, systemProgram: SystemProgram.programId })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
        await programs.core.methods
          .initializeVaultReserves()
          .accounts({
            admin: admin.publicKey,
            config,
            vault,
            usdcMint: vaultState.data?.usdcMint ?? USDC_MINT,
            vaultUsdcReserve: reserve,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
        await programs.core.methods
          .initializeVaultLossBucket()
          .accounts({
            admin: admin.publicKey,
            config,
            vault,
            usdcMint: vaultState.data?.usdcMint ?? USDC_MINT,
            lossBucket,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
      }

      for (const kind of [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const) {
        const [tranche] = getTranchePda(vault, kind, programs.core.programId);
        if (await programs.core.account.tranche.fetchNullable(tranche)) continue;
        await programs.core.methods
          .initializeTranche(kind, kind === TrancheKind.Prime ? 500 : kind === TrancheKind.Core ? 800 : 1500)
          .accounts({
            admin: admin.publicKey,
            config,
            vault,
            tranche,
            trancheMint: getTrancheMintPda(vault, kind, programs.core.programId)[0],
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
      }

      if (!(await programs.core.account.loan.fetchNullable(loan))) {
        await programs.core.methods
          .initializeLoan(
            0,
            bn(DEFAULT_DEMO_LOAN_PRINCIPAL),
            800,
            new BN(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60),
            identity.identities.borrower.keypair.publicKey,
          )
          .accounts({ admin: admin.publicKey, config, vault, loan, systemProgram: SystemProgram.programId })
          .signers([admin])
          .rpc({ commitment: 'confirmed' });
      }

      const usdcMint = vaultState.data?.usdcMint ?? USDC_MINT;

      // Initialize AMM pools for each tranche
      for (const kind of [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const) {
        const [trancheMint] = getTrancheMintPda(vault, kind, programs.core.programId);
        const [pool] = getPoolPda(trancheMint, programs.amm.programId);
        if (!(await programs.amm.account.ammPool.fetchNullable(pool))) {
          await programs.amm.methods
            .initializePool(30)
            .accounts({
              admin: admin.publicKey,
              trancheMint,
              quoteMint: usdcMint,
              pool,
              systemProgram: SystemProgram.programId,
            })
            .signers([admin])
            .rpc({ commitment: 'confirmed' });
          await programs.amm.methods
            .initializePoolReserves()
            .accounts({
              admin: admin.publicKey,
              pool,
              trancheMint,
              quoteMint: usdcMint,
              trancheReserve: getPoolTrancheReservePda(trancheMint, programs.amm.programId)[0],
              quoteReserve: getPoolQuoteReservePda(trancheMint, programs.amm.programId)[0],
              lpMint: getLpMintPda(trancheMint, programs.amm.programId)[0],
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([admin])
            .rpc({ commitment: 'confirmed' });
        }
      }

      // Ensure borrower USDC ATA exists so accrueYield doesn't fail with AccountNotInitialized
      const borrower = identity.identities.borrower.keypair;
      const borrowerAta = await getAssociatedTokenAddress(usdcMint, borrower.publicKey);
      if (!(await connection.getAccountInfo(borrowerAta))) {
        const { Transaction: Tx } = await import('@solana/web3.js');
        const tx = new Tx().add(
          createAssociatedTokenAccountInstruction(admin.publicKey, borrowerAta, borrower.publicKey, usdcMint),
        );
        await programs.core.provider.sendAndConfirm(tx, [admin]);
      }

      addEntry({
        action: 'Initialize Vault Scaffold',
        role: 'Protocol Admin',
        status: 'info',
        message: 'Config, vault, reserves, tranches, loan, AMM pools, and borrower ATA were checked or initialized on-chain.',
        navSnapshot: await navSnapshot(),
        deltas: {},
      });
    },
    onSuccess: afterMutation,
    onError: (error) => toast.error(formatError(error)),
  });

  const mutateYield = accrueYield.mutate;
  const mutateDefault = triggerDefault.mutate;
  const mutateMarket = marketReaction.mutate;

  useEffect(() => {
    return registerActions({
      yield: () => mutateYield(),
      default: () => mutateDefault(),
      market: () => mutateMarket(),
    });
  }, [mutateYield, mutateDefault, mutateMarket, registerActions]);

  const busy =
    deposit.isPending ||
    withdraw.isPending ||
    accrueYield.isPending ||
    triggerDefault.isPending ||
    emergencySell.isPending ||
    marketReaction.isPending ||
    disburse.isPending ||
    repay.isPending ||
    initialize.isPending;

  return (
    <section className="rounded-lg border border-white/10 bg-black/30 p-5" aria-label="Action panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            Action Panel
            <InfoTip>
              Sends real on-chain transactions to the PRISM contracts on Solana devnet, signed by the demo keypair for the active role.
              Switch role in the sidebar to act as a different participant.
            </InfoTip>
          </div>
          <p className="mt-1 text-xs text-white/45">{identity.label} signed transactions only.</p>
        </div>
        <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-[10px] uppercase text-white/60">
          confirmed
        </span>
      </div>

      {identity.role === 'senior' || identity.role === 'junior' ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Landmark className="h-4 w-4 text-white/50" />
              {investorTrancheConfig.label} tranche entry
              <InfoTip>
                Deposits USDC into the {investorTrancheConfig.label} tranche and mints p{investorTrancheConfig.label.toUpperCase()} tokens 1:1 at NAV.
                These tokens represent your share of the tranche and accrue yield as the waterfall pays down. First deposit mints 1:1; later deposits mint <code className="rounded bg-white/10 px-1">amount / nav_per_share</code>.
              </InfoTip>
            </div>
            <p className="mt-1 text-xs text-white/45">Amount in USDC (6 decimals). You will receive p{investorTrancheConfig.label.toUpperCase()} tranche tokens.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} />
              <Button disabled={busy} onClick={() => deposit.mutate()} className="w-full gap-2 sm:w-auto">
                <WalletCards className="h-4 w-4" />
                Deposit
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Banknote className="h-4 w-4 text-white/50" />
              Withdraw or emergency exit
              <InfoTip>
                Two exit paths.
                <strong className="block pt-1">Withdraw</strong> burns p-tokens at the contract and pulls USDC straight from the vault reserve at current NAV — fails if the reserve is short.
                <strong className="block pt-1">AMM Exit</strong> swaps p-tokens for USDC on the secondary pool — always available, but you take market price (which can be below NAV after a credit event).
              </InfoTip>
            </div>
            <p className="mt-1 text-xs text-white/45">First field: shares to redeem. Second field: shares to swap on the AMM.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Input value={withdrawShares} onChange={(event) => setWithdrawShares(event.target.value)} />
              <Button disabled={busy} variant="secondary" onClick={() => withdraw.mutate()} className="w-full sm:w-auto">
                Withdraw
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => emergencySell.mutate()} className="w-full gap-2 sm:w-auto">
                <TrendingDown className="h-4 w-4" />
                AMM Exit
              </Button>
            </div>
            <Input className="mt-2" value={swapAmount} onChange={(event) => setSwapAmount(event.target.value)} />
          </div>
        </div>
      ) : null}

      {identity.role === 'borrower' ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              Loan lifecycle
              <InfoTip>
                <strong className="block">Disburse</strong> moves USDC out of the vault reserve into the borrower wallet — turns deposits into a productive loan position.
                <strong className="block pt-1">Repay</strong> sends USDC back into the vault. Combine with <em>Accrue Yield</em> from the admin to model coupon payments flowing through the waterfall.
              </InfoTip>
            </div>
            <p className="mt-1 text-xs text-white/45">USDC amount. Disburse pulls from vault reserve; Repay pushes back in.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Input value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} />
              <Button disabled={busy} onClick={() => disburse.mutate()} className="w-full sm:w-auto">
                Disburse
              </Button>
              <Button disabled={busy} variant="secondary" onClick={() => repay.mutate()} className="w-full sm:w-auto">
                Repay
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {identity.role === 'admin' ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Play className="h-4 w-4 text-white/50" />
              Protocol operations
              <InfoTip>
                Admin-only triggers that drive the demo arc.
                <strong className="block pt-1">Accrue Yield</strong> injects coupon income — distributed top-down: Prime → Core → Alpha.
                <strong className="block pt-1">Trigger Default</strong> burns USDC into the loss bucket — losses cascade bottom-up: Alpha → Core → Prime.
                <strong className="block pt-1">Market Reaction</strong> simulates AMM repricing after a credit event.
                <strong className="block pt-1">Initialize</strong> idempotently sets up config, vault, tranches, loan, and AMM pools.
              </InfoTip>
            </div>
            <p className="mt-1 text-xs text-white/45">USDC amount for the next yield distribution.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input value={yieldAmount} onChange={(event) => setYieldAmount(event.target.value)} />
              <Button disabled={busy} onClick={() => accrueYield.mutate()} className="w-full sm:w-auto">
                Accrue Yield
              </Button>
            </div>
            <p className="mt-3 text-xs text-white/45">USDC loss to realize on the loan. Cascades up from Alpha.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input value={lossAmount} onChange={(event) => setLossAmount(event.target.value)} />
              <Button disabled={busy} variant="destructive" onClick={() => triggerDefault.mutate()} className="w-full gap-2 sm:w-auto">
                <ShieldAlert className="h-4 w-4" />
                Trigger Default
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button disabled={busy} variant="outline" onClick={() => marketReaction.mutate()} className="w-full gap-2">
                <Flame className="h-4 w-4" />
                Run Market Reaction
              </Button>
              <Button disabled={busy} variant="secondary" onClick={() => initialize.mutate()} className="w-full gap-2">
                <RotateCcw className="h-4 w-4" />
                Initialize
              </Button>
            </div>
          </div>
          <div className="flex gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Failed withdrawals surface the on-chain error and point the user to AMM exit liquidity.
          </div>
        </div>
      ) : null}
    </section>
  );
}
