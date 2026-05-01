'use client';

import { useState } from 'react';
import { useLoanApplications } from '@/hooks/useLoanApplications';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { AnchorProvider, Program, BN, type Idl } from '@coral-xyz/anchor';
import { SystemProgram, SYSVAR_RENT_PUBKEY, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import adminSecret from '@/contracts/keys/admin.json';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { toast } from 'sonner';

import {
  PRISM_CORE_PROGRAM_ID,
  PRISM_AMM_PROGRAM_ID,
  USDC_MINT,
  VAULT_ID,
  TrancheKind,
} from '@/app/lib/constants';
import {
  getConfigPda,
  getVaultPda,
  getTranchePda,
  getTrancheMintPda,
  getVaultReservePda,
  getLossBucketPda,
  getLoanPda,
  getCreditEventPda,
  getIkaCollateralPda,
  getPoolPda,
  getPoolTrancheReservePda,
  getPoolQuoteReservePda,
  getLpMintPda,
} from '@/app/lib/pda';
import prismCoreIdl from '@/app/lib/idl/prism_core.json';
import prismAmmIdl from '@/app/lib/idl/prism_amm.json';

import {
  useIkaCollateralAccount,
} from '@/hooks/useIkaCollateral';

type StepStatus = 'idle' | 'running' | 'done' | 'error';

const SETUP_STEPS = [
  'Global Config',
  'Vault + Reserves',
  'Tranches',
  'Loan',
  'AMM Pools',
];

export function AdminPanel() {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const { applications, approve, reject } = useLoanApplications();
  const [log, setLog] = useState<string[]>([]);
  const [setupRunning, setSetupRunning] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    SETUP_STEPS.map(() => 'idle'),
  );

  // Manual parameters state
  const [params, setParams] = useState({
    loanPrincipal: '20000',
    loanApr: '8',
    loanMaturityDays: '365',
    yieldAmount: '100',
    lossAmount: '6500',
    severity: '100',
    repayAmount: '20000',
    faucetAmount: '1000',
  });

  const [activeMode, setActiveMode] = useState<'auto' | 'manual'>('auto');

  // Track collateral for the current test loan (ID 0 in vault 0)
  const pdas = getPdas();
  const { data: ikaCollateral } = useIkaCollateralAccount(pdas.loan);
  const ikaStatus = ikaCollateral?.status;

  function addLog(msg: string) {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  function setStep(i: number, status: StepStatus) {
    setStepStatuses((prev) => {
      const next = [...prev];
      next[i] = status;
      return next;
    });
  }

  function getAdminKeypair() {
    return Keypair.fromSecretKey(Uint8Array.from(adminSecret as number[]));
  }

  function getPrograms() {
    const admin = getAdminKeypair();
    const adminWallet = {
      publicKey: admin.publicKey,
      signTransaction: async <T extends Parameters<AnchorProvider['sendAndConfirm']>[0]>(tx: T) => { (tx as any).partialSign?.(admin); return tx; },
      signAllTransactions: async <T extends Parameters<AnchorProvider['sendAndConfirm']>[0]>(txs: T[]) => txs,
    };
    const provider = new AnchorProvider(connection, adminWallet as any, { commitment: 'confirmed' });
    const core = new Program(prismCoreIdl as Idl, provider) as any;
    const amm = new Program(prismAmmIdl as Idl, provider) as any;
    return { core, amm, adminKeypair: admin };
  }

  function getPdas() {
    const [config] = getConfigPda(PRISM_CORE_PROGRAM_ID);
    const [vault] = getVaultPda(VAULT_ID, PRISM_CORE_PROGRAM_ID);
    const [trancheP] = getTranchePda(vault, TrancheKind.Prime, PRISM_CORE_PROGRAM_ID);
    const [trancheC] = getTranchePda(vault, TrancheKind.Core, PRISM_CORE_PROGRAM_ID);
    const [trancheA] = getTranchePda(vault, TrancheKind.Alpha, PRISM_CORE_PROGRAM_ID);
    const [mintP] = getTrancheMintPda(vault, TrancheKind.Prime, PRISM_CORE_PROGRAM_ID);
    const [mintC] = getTrancheMintPda(vault, TrancheKind.Core, PRISM_CORE_PROGRAM_ID);
    const [mintA] = getTrancheMintPda(vault, TrancheKind.Alpha, PRISM_CORE_PROGRAM_ID);
    const [reserve] = getVaultReservePda(vault, PRISM_CORE_PROGRAM_ID);
    const [lossBucket] = getLossBucketPda(vault, PRISM_CORE_PROGRAM_ID);
    const [loan] = getLoanPda(vault, 0, PRISM_CORE_PROGRAM_ID);
    const [poolP] = getPoolPda(mintP, PRISM_AMM_PROGRAM_ID);
    const [poolC] = getPoolPda(mintC, PRISM_AMM_PROGRAM_ID);
    const [poolA] = getPoolPda(mintA, PRISM_AMM_PROGRAM_ID);
    return {
      config, vault,
      tranches: { prime: trancheP, core: trancheC, alpha: trancheA },
      mints: { prime: mintP, core: mintC, alpha: mintA },
      reserve, lossBucket, loan,
      pools: { prime: poolP, core: poolC, alpha: poolA },
    };
  }

  // ── Individual Step Functions ──────────────────────────────────────────

  async function setupGlobalConfig() {
    const { core, adminKeypair } = getPrograms();
    const p = getPdas();
    const admin = adminKeypair.publicKey;
    setStep(0, 'running');
    try {
      console.log('Using config PDA:', p.config.toBase58());
      const existing = await core.account.globalConfig.fetchNullable(p.config);
      if (existing) {
        addLog('Global config already exists — skipping');
      } else {
        await core.methods
          .initializeGlobalConfig(0, [admin])
          .accounts({ admin, config: p.config, usdcMint: USDC_MINT, systemProgram: SystemProgram.programId })
          .rpc({ commitment: 'confirmed' });
        addLog('✓ Global config initialized');
      }
      setStep(0, 'done');
      return true;
    } catch (e: any) {
      addLog(`✗ Global config: ${e.message}`);
      console.error(e);
      setStep(0, 'error');
      return false;
    }
  }

  async function setupVault() {
    const { core, adminKeypair } = getPrograms();
    const p = getPdas();
    const admin = adminKeypair.publicKey;
    setStep(1, 'running');
    try {
      const existing = await core.account.vault.fetchNullable(p.vault);
      if (existing) {
        addLog('Vault already exists — skipping');
      } else {
        await core.methods
          .initializeVault(VAULT_ID)
          .accounts({ admin, config: p.config, vault: p.vault, systemProgram: SystemProgram.programId })
          .rpc({ commitment: 'confirmed' });
        addLog('✓ Vault created');

        await core.methods
          .initializeVaultReserves()
          .accounts({
            admin, config: p.config, vault: p.vault, usdcMint: USDC_MINT,
            vaultUsdcReserve: p.reserve, tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' });
        addLog('✓ Vault reserve initialized');

        await core.methods
          .initializeVaultLossBucket()
          .accounts({
            admin, config: p.config, vault: p.vault, usdcMint: USDC_MINT,
            lossBucket: p.lossBucket, tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' });
        addLog('✓ Loss bucket initialized');
      }
      setStep(1, 'done');
      return true;
    } catch (e: any) {
      addLog(`✗ Vault: ${e.message}`);
      console.error(e);
      setStep(1, 'error');
      return false;
    }
  }

  async function setupTranches() {
    const { core, adminKeypair } = getPrograms();
    const p = getPdas();
    const admin = adminKeypair.publicKey;
    setStep(2, 'running');
    try {
      const trancheParams = [
        { kind: TrancheKind.Prime, apy: 500,  pda: p.tranches.prime, mint: p.mints.prime, label: 'Prime' },
        { kind: TrancheKind.Core,  apy: 1200, pda: p.tranches.core,  mint: p.mints.core,  label: 'Core'  },
        { kind: TrancheKind.Alpha, apy: 0,    pda: p.tranches.alpha, mint: p.mints.alpha, label: 'Alpha' },
      ];
      for (const t of trancheParams) {
        const existing = await core.account.tranche.fetchNullable(t.pda);
        if (existing) {
          addLog(`${t.label} tranche already exists — skipping`);
          continue;
        }
        await core.methods
          .initializeTranche(t.kind, t.apy)
          .accounts({
            admin, config: p.config, vault: p.vault,
            tranche: t.pda, trancheMint: t.mint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc({ commitment: 'confirmed' });
        addLog(`✓ ${t.label} tranche initialized`);
      }
      setStep(2, 'done');
      return true;
    } catch (e: any) {
      addLog(`✗ Tranches: ${e.message}`);
      console.error(e);
      setStep(2, 'error');
      return false;
    }
  }

  async function setupLoan() {
    const { core, adminKeypair } = getPrograms();
    const p = getPdas();
    const admin = adminKeypair.publicKey;
    setStep(3, 'running');
    try {
      const existing = await core.account.loan.fetchNullable(p.loan);
      if (existing) {
        addLog('Loan already exists — skipping');
      } else {
        const maturityDays = parseInt(params.loanMaturityDays);
        const maturity = new BN(Math.floor(Date.now() / 1000) + maturityDays * 24 * 60 * 60);
        const principal = new BN(parseFloat(params.loanPrincipal) * 1_000_000);
        const apr = parseInt(params.loanApr) * 100;

        await core.methods
          .initializeLoan(0, principal, apr, maturity, admin)
          .accounts({ admin, config: p.config, vault: p.vault, loan: p.loan, systemProgram: SystemProgram.programId })
          .rpc({ commitment: 'confirmed' });
        addLog(`✓ Loan initialized (${params.loanPrincipal} USDC @ ${params.loanApr}% APR)`);
      }
      setStep(3, 'done');
      return true;
    } catch (e: any) {
      addLog(`✗ Loan: ${e.message}`);
      console.error(e);
      setStep(3, 'error');
      return false;
    }
  }

  async function setupAmmPools() {
    const { amm, adminKeypair } = getPrograms();
    const p = getPdas();
    const admin = adminKeypair.publicKey;
    setStep(4, 'running');
    try {
      const poolEntries = [
        { label: 'Prime', mint: p.mints.prime, pool: p.pools.prime },
        { label: 'Core',  mint: p.mints.core,  pool: p.pools.core  },
        { label: 'Alpha', mint: p.mints.alpha,  pool: p.pools.alpha },
      ];
      for (const entry of poolEntries) {
        const [trancheReserve] = getPoolTrancheReservePda(entry.mint, PRISM_AMM_PROGRAM_ID);
        const [quoteReserve]   = getPoolQuoteReservePda(entry.mint, PRISM_AMM_PROGRAM_ID);
        const [lpMint]         = getLpMintPda(entry.mint, PRISM_AMM_PROGRAM_ID);

        const existing = await amm.account.ammPool.fetchNullable(entry.pool);
        if (existing) {
          addLog(`${entry.label} AMM pool already exists — skipping`);
          continue;
        }
        await amm.methods
          .initializePool(30)
          .accounts({ admin, trancheMint: entry.mint, quoteMint: USDC_MINT, pool: entry.pool, systemProgram: SystemProgram.programId })
          .rpc({ commitment: 'confirmed' });

        await amm.methods
          .initializePoolReserves()
          .accounts({
            admin, pool: entry.pool, trancheMint: entry.mint, quoteMint: USDC_MINT,
            trancheReserve, quoteReserve, lpMint,
            tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: 'confirmed' });
        addLog(`✓ ${entry.label} AMM pool initialized`);
      }
      setStep(4, 'done');
      return true;
    } catch (e: any) {
      addLog(`✗ AMM pools: ${e.message}`);
      console.error(e);
      setStep(4, 'error');
      return false;
    }
  }

  async function runFullSetup() {
    if (!wallet) { toast.error('Connect wallet first'); return; }
    setSetupRunning(true);
    setLog([]);
    setStepStatuses(SETUP_STEPS.map(() => 'idle'));

    try {
      if (!await setupGlobalConfig()) return;
      if (!await setupVault()) return;
      if (!await setupTranches()) return;
      if (!await setupLoan()) return;
      if (!await setupAmmPools()) return;

      addLog('');
      addLog('🎉 Protocol ready — users can now deposit via the Dashboard');
      toast.success('Protocol initialized!');
    } catch {
      toast.error('Setup failed — check the log');
    } finally {
      setSetupRunning(false);
    }
  }

  async function deposit(kind: TrancheKind, label: string, amountUsdc: string) {
    if (!wallet) { toast.error('Connect wallet first'); return; }
    try {
      const { core, adminKeypair } = getPrograms();
      const p = getPdas();
      const admin = adminKeypair.publicKey;
      const amount = BigInt(parseFloat(amountUsdc) * 1_000_000);

      const tranchePda = kind === TrancheKind.Prime ? p.tranches.prime : kind === TrancheKind.Core ? p.tranches.core : p.tranches.alpha;
      const trancheMint = kind === TrancheKind.Prime ? p.mints.prime : kind === TrancheKind.Core ? p.mints.core : p.mints.alpha;
      const adminUsdcAta = await getAssociatedTokenAddress(USDC_MINT, admin);
      const adminTrancheAta = await getAssociatedTokenAddress(trancheMint, admin);

      await core.methods
        .deposit(kind, new BN(amount.toString()))
        .accounts({
          user: admin,
          config: p.config,
          vault: p.vault,
          tranche: tranchePda,
          trancheMint,
          userUsdcAta: adminUsdcAta,
          vaultUsdcReserve: p.reserve,
          userTrancheAta: adminTrancheAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' });

      addLog(`✓ Deposited ${amountUsdc} USDC into ${label}`);
      toast.success(`Deposited into ${label}`);
    } catch (e: any) {
      addLog(`✗ Deposit ${label}: ${e.message}`);
      toast.error(`Deposit failed: ${e.message}`);
    }
  }

  async function accrueYield() {
    if (!wallet) { toast.error('Connect wallet first'); return; }
    try {
      const { core, adminKeypair } = getPrograms();
      const p = getPdas();
      const admin = adminKeypair.publicKey;
      const adminUsdcAta = await getAssociatedTokenAddress(USDC_MINT, admin);
      const amount = new BN(parseFloat(params.yieldAmount) * 1_000_000);

      // Ensure the admin USDC ATA exists. accrue_yield transfers FROM the borrower
      // (= admin in this simulation harness) so the ATA must be initialized AND funded.
      const ataInfo = await connection.getAccountInfo(adminUsdcAta);
      if (!ataInfo) {
        const createTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(admin, adminUsdcAta, admin, USDC_MINT),
        );
        const bh = await connection.getLatestBlockhash('confirmed');
        createTx.recentBlockhash = bh.blockhash;
        createTx.feePayer = admin;
        createTx.sign(adminKeypair);
        const sig = await connection.sendRawTransaction(createTx.serialize());
        await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
        addLog(`✓ Created admin USDC ATA. Now request USDC from Circle's faucet.`);
        toast(`ATA created — admin still needs USDC. Click "Mint USDC" to open Circle's faucet.`);
        return;
      }

      await core.methods
        .accrueYield(amount)
        .accounts({
          authority: admin,
          config: p.config,
          vault: p.vault,
          tranchePrime: p.tranches.prime,
          trancheCore: p.tranches.core,
          trancheAlpha: p.tranches.alpha,
          borrower: admin,
          borrowerUsdcAta: adminUsdcAta,
          vaultUsdcReserve: p.reserve,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: 'confirmed' });

      addLog(`✓ Accrued ${params.yieldAmount} USDC yield — waterfall distributed to tranches`);
      toast.success(`Yield accrued: ${params.yieldAmount} USDC via waterfall`);
    } catch (e: any) {
      addLog(`✗ Yield: ${e.message}`);
      toast.error(`Yield failed: ${e.message}`);
    }
  }

  async function disburseLoan() {
    if (!wallet) { toast.error('Connect wallet first'); return; }
    try {
      const { core, adminKeypair } = getPrograms();
      const p = getPdas();
      const admin = adminKeypair.publicKey;

      // Fetch the on-chain loan to get the actual borrower pubkey.
      const loanAcc = await (core.account as any).loan.fetch(p.loan);
      const borrower: PublicKey = loanAcc.borrower;
      const principal: bigint = BigInt(loanAcc.principal.toString());

      // Pre-check the vault reserve has enough USDC.
      const reserveAcc = await (core.provider.connection.getTokenAccountBalance(p.reserve)).value;
      const reserveAmount = BigInt(reserveAcc.amount);
      if (reserveAmount < principal) {
        const need = (Number(principal) / 1_000_000).toFixed(2);
        const have = (Number(reserveAmount) / 1_000_000).toFixed(2);
        const msg = `Vault reserve has ${have} USDC, need ${need}. Fund vault by depositing USDC into Prime/Core/Alpha first (Section 2). Use Circle's faucet to get devnet USDC.`;
        addLog(`✗ Disburse: ${msg}`);
        toast.error(msg);
        return;
      }

      const borrowerUsdcAta = await getAssociatedTokenAddress(USDC_MINT, borrower);

      // Create the borrower's USDC ATA if it doesn't exist yet.
      const ataInfo = await connection.getAccountInfo(borrowerUsdcAta);
      if (!ataInfo) {
        const createAtaTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(admin, borrowerUsdcAta, borrower, USDC_MINT),
        );
        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        createAtaTx.recentBlockhash = latestBlockhash.blockhash;
        createAtaTx.feePayer = admin;
        createAtaTx.sign(adminKeypair);
        const ataSig = await connection.sendRawTransaction(createAtaTx.serialize());
        await connection.confirmTransaction({ signature: ataSig, ...latestBlockhash }, 'confirmed');
        addLog(`✓ Created USDC ATA for borrower ${borrower.toBase58().slice(0, 8)}…`);
      }

      // Check for IKA collateral
      const [ikaCollateralPda] = getIkaCollateralPda(p.loan);
      const ikaAcc = await core.account.ikaCollateral.fetchNullable(ikaCollateralPda);

      await (core.methods as any)
        .disburseLoan()
        .accounts({
          admin,
          config: p.config,
          vault: p.vault,
          loan: p.loan,
          vaultUsdcReserve: p.reserve,
          borrowerUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          ikaCollateral: ikaAcc ? ikaCollateralPda : null,
        })
        .rpc({ commitment: 'confirmed' });
      addLog(`✓ Loan disbursed — USDC sent to borrower ${borrower.toBase58().slice(0, 8)}…`);
      toast.success('Loan disbursed');
    } catch (e: any) {
      addLog(`✗ Disburse: ${e.message}`);
      toast.error(`Disburse failed: ${e.message}`);
    }
  }

  async function repayLoan() {
    if (!wallet) { toast.error('Connect wallet first'); return; }
    try {
      const { core, adminKeypair } = getPrograms();
      const p = getPdas();
      const admin = adminKeypair.publicKey;
      const amount = new BN(parseFloat(params.repayAmount) * 1_000_000);
      const borrowerUsdcAta = await getAssociatedTokenAddress(USDC_MINT, admin);
      await (core.methods as any)
        .repayLoan(amount)
        .accounts({
          borrower: admin,
          config: p.config,
          vault: p.vault,
          loan: p.loan,
          borrowerUsdcAta,
          vaultUsdcReserve: p.reserve,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' });
      addLog(`✓ Repaid ${params.repayAmount} USDC — reserve restored`);
      toast.success('Loan repaid');
    } catch (e: any) {
      addLog(`✗ Repay: ${e.message}`);
      toast.error(`Repay failed: ${e.message}`);
    }
  }

  // Originate a loan for an approved application.
  // Calls initialize_loan with the applicant's wallet as borrower, then marks the app approved.
  async function originateLoanForApplicant(
    appId: string,
    borrowerPubkeyStr: string,
    requestedUSDC: number,
    maturityDays: number,
    nextLoanId: number,
  ) {
    try {
      const { core, adminKeypair } = getPrograms();
      const p = getPdas();
      const borrower = new PublicKey(borrowerPubkeyStr);
      const principal = new BN(requestedUSDC * 1_000_000);
      const apr = parseInt(params.loanApr) * 100;
      const maturity = new BN(Math.floor(Date.now() / 1000) + maturityDays * 24 * 60 * 60);
      const [loanPda] = getLoanPda(p.vault, nextLoanId, PRISM_CORE_PROGRAM_ID);
      await core.methods
        .initializeLoan(nextLoanId, principal, apr, maturity, borrower)
        .accounts({ admin: adminKeypair.publicKey, config: p.config, vault: p.vault, loan: loanPda, systemProgram: SystemProgram.programId })
        .signers([adminKeypair])
        .rpc({ commitment: 'confirmed' });
      approve(appId, nextLoanId, apr);
      addLog(`✓ Loan originated for ${borrowerPubkeyStr.slice(0, 8)}… — $${requestedUSDC} USDC`);
      toast.success('Loan originated on-chain');
    } catch (e: any) {
      addLog(`✗ Originate: ${e.message}`);
      toast.error(`Originate failed: ${e.message}`);
    }
  }

  async function triggerDefault() {
    if (!wallet) { toast.error('Connect wallet first'); return; }
    try {
      const { core, adminKeypair } = getPrograms();
      const p = getPdas();
      const admin = adminKeypair.publicKey;

      const vaultAccount = await core.account.vault.fetch(p.vault);
      const seq: number = vaultAccount.creditEventSeq ?? 0;
      const [creditEvent] = getCreditEventPda(p.vault, seq, PRISM_CORE_PROGRAM_ID);

      const amount = new BN(parseFloat(params.lossAmount) * 1_000_000);
      const severity = parseInt(params.severity) * 100;

      // Pre-check: trigger_credit_event transfers loss USDC from the vault reserve to
      // the loss bucket. If the reserve is empty the SPL transfer fails with 0x1.
      const reserveBalance = (await connection.getTokenAccountBalance(p.reserve)).value;
      const lossLamports = BigInt(amount.toString());
      if (BigInt(reserveBalance.amount) < lossLamports) {
        const have = (Number(reserveBalance.amount) / 1_000_000).toFixed(2);
        const need = (Number(lossLamports) / 1_000_000).toFixed(2);
        const msg = `Vault reserve has ${have} USDC, need ${need} to cascade. Deposit into tranches first.`;
        addLog(`✗ Default: ${msg}`);
        toast.error(msg);
        return;
      }

      await core.methods
        .triggerCreditEvent(0, amount, severity)
        .accounts({
          authority: admin,
          config: p.config,
          vault: p.vault,
          tranchePrime: p.tranches.prime,
          trancheCore: p.tranches.core,
          trancheAlpha: p.tranches.alpha,
          vaultUsdcReserve: p.reserve,
          lossBucket: p.lossBucket,
          creditEvent,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' });

      addLog(`✓ Credit event triggered — ${params.lossAmount} USDC loss cascaded: Alpha → Core → Prime`);
      toast.success('Default triggered — loss cascade complete');
    } catch (e: any) {
      addLog(`✗ Default: ${e.message}`);
      toast.error(`Default failed: ${e.message}`);
    }
  }

  // The vault uses Circle's official devnet USDC mint. We cannot mint it ourselves —
  // only Circle is the mint authority. The "faucet" button opens Circle's faucet
  // and copies the admin address so the user can paste it.
  async function mintUsdc() {
    if (!wallet) { toast.error('Connect wallet first'); return; }
    try {
      const { adminKeypair } = getPrograms();
      const adminAddr = adminKeypair.publicKey.toBase58();
      const phantomAddr = wallet.publicKey.toBase58();
      try { await navigator.clipboard.writeText(adminAddr); } catch {}
      window.open('https://faucet.circle.com/', '_blank', 'noopener');
      addLog(`ℹ Circle faucet opened. Admin (paste this): ${adminAddr}`);
      addLog(`ℹ Phantom wallet (also needs USDC for repay): ${phantomAddr}`);
      toast.success('Circle faucet opened — admin address copied to clipboard. Request USDC there.');
    } catch (e: any) {
      addLog(`✗ Faucet: ${e.message}`);
      toast.error(`Faucet failed: ${e.message}`);
    }
  }

  async function liquidateCollateral() {
    if (!wallet) { toast.error('Connect wallet first'); return; }
    try {
      const { core, adminKeypair } = getPrograms();
      const p = getPdas();
      const admin = adminKeypair.publicKey;
      const [ikaCollateralPda] = getIkaCollateralPda(p.loan);
      await core.methods
        .liquidateIkaCollateral()
        .accounts({
          admin,
          config: p.config,
          vault: p.vault,
          loan: p.loan,
          ikaCollateral: ikaCollateralPda,
        })
        .rpc({ commitment: 'confirmed' });
      addLog('✓ IKA collateral liquidated — IKA Network will seize BTC/ETH');
      toast.success('Collateral liquidated');
    } catch (e: any) {
      addLog(`✗ Liquidate: ${e.message}`);
      toast.error(`Liquidation failed: ${e.message}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
          <p className="text-sm text-white/40">
            Vault {VAULT_ID} · {PRISM_CORE_PROGRAM_ID.toBase58().slice(0, 8)}…
          </p>
        </div>
        <WalletMultiButton style={{}} />
      </div>

      {/* Step 1: Protocol Setup */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <h2 className="text-sm font-medium text-white/80">1 · Protocol Setup</h2>
          <div className="flex gap-2 p-1 rounded-lg bg-black/40 border border-white/5">
            <button
              onClick={() => setActiveMode('auto')}
              className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-all ${activeMode === 'auto' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-white/30 hover:text-white/50'}`}
            >
              Automatic
            </button>
            <button
              onClick={() => setActiveMode('manual')}
              className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-md transition-all ${activeMode === 'manual' ? 'bg-purple-500/20 text-purple-300 shadow-sm' : 'text-white/30 hover:text-white/50'}`}
            >
              Manual
            </button>
          </div>
        </div>

        {activeMode === 'auto' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">Run all initialization steps in sequence with default parameters.</p>
              <button
                onClick={runFullSetup}
                disabled={setupRunning || !wallet}
                className="rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 py-1.5 text-sm text-purple-200 transition-colors hover:bg-purple-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {setupRunning ? 'Running…' : 'Run Full Setup'}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {SETUP_STEPS.map((step, i) => (
                <div
                  key={step}
                  className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center"
                >
                  <span
                    className={
                      stepStatuses[i] === 'done' ? 'text-emerald-400' :
                      stepStatuses[i] === 'running' ? 'animate-pulse text-yellow-400' :
                      stepStatuses[i] === 'error' ? 'text-red-400' :
                      'text-white/20'
                    }
                  >
                    {stepStatuses[i] === 'done' ? '✓' :
                     stepStatuses[i] === 'error' ? '✗' :
                     stepStatuses[i] === 'running' ? '◉' : '○'}
                  </span>
                  <span className="text-[10px] text-white/50 leading-tight">{step}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Loan Params */}
              <div className="space-y-3 p-4 rounded-lg bg-black/20 border border-white/5">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-tight">Loan Parameters</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30 uppercase">Principal (USDC)</label>
                    <input
                      type="text"
                      value={params.loanPrincipal}
                      onChange={(e) => setParams(p => ({ ...p, loanPrincipal: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30 uppercase">APR (%)</label>
                    <input
                      type="text"
                      value={params.loanApr}
                      onChange={(e) => setParams(p => ({ ...p, loanApr: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] text-white/30 uppercase">Maturity (Days)</label>
                    <input
                      type="text"
                      value={params.loanMaturityDays}
                      onChange={(e) => setParams(p => ({ ...p, loanMaturityDays: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Step Buttons */}
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: 'Init Global Config', fn: setupGlobalConfig, idx: 0 },
                  { label: 'Init Vault & Reserves', fn: setupVault, idx: 1 },
                  { label: 'Init Tranches', fn: setupTranches, idx: 2 },
                  { label: 'Init Loan (w/ custom params)', fn: setupLoan, idx: 3 },
                  { label: 'Init AMM Pools', fn: setupAmmPools, idx: 4 },
                ].map((step) => (
                  <button
                    key={step.label}
                    onClick={step.fn}
                    disabled={!wallet}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/80"
                  >
                    <span>{step.label}</span>
                    <span className={
                      stepStatuses[step.idx] === 'done' ? 'text-emerald-400' :
                      stepStatuses[step.idx] === 'running' ? 'animate-pulse text-yellow-400' :
                      stepStatuses[step.idx] === 'error' ? 'text-red-400' :
                      'text-white/20'
                    }>
                      {stepStatuses[step.idx] === 'done' ? '✓' :
                       stepStatuses[step.idx] === 'error' ? '✗' :
                       stepStatuses[step.idx] === 'running' ? '◉' : '→'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Seed Deposits */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">2 · Seed Deposits</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Amount (USDC)"
              defaultValue="5000"
              id="depositAmount"
              className="w-24 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3">
          {[
            { kind: TrancheKind.Prime, label: 'Prime', apy: '5%', color: 'sky' },
            { kind: TrancheKind.Core, label: 'Core', apy: '12%', color: 'amber' },
            { kind: TrancheKind.Alpha, label: 'Alpha', apy: 'Residual', color: 'rose' },
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => {
                const amount = (document.getElementById('depositAmount') as HTMLInputElement).value || '5000';
                deposit(t.kind, t.label, amount);
              }}
              disabled={!wallet}
              className={`flex-1 rounded-lg border border-${t.color}-400/30 bg-${t.color}-500/10 py-2 text-xs text-${t.color}-200 hover:bg-${t.color}-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-center`}
            >
              Deposit to {t.label}<br />
              <span className="text-[10px] text-white/40">{t.apy} APY</span>
            </button>
          ))}
        </div>

        {/* Dev Faucet — only works if wallet is USDC mint authority */}
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider whitespace-nowrap">Dev Faucet</span>
          <input
            type="text"
            value={params.faucetAmount}
            onChange={(e) => setParams(p => ({ ...p, faucetAmount: e.target.value }))}
            className="w-20 bg-black/30 border border-amber-500/20 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
          />
          <span className="text-[10px] text-amber-400/50">USDC</span>
          <button
            onClick={mintUsdc}
            disabled={!wallet}
            className="rounded bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-40 whitespace-nowrap"
          >
            Mint to Wallet
          </button>
          <span className="text-[10px] text-white/20 truncate">wallet must be mint authority</span>
        </div>
      </section>

      {/* Step 3: Simulate Events */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-6">
        <h2 className="text-sm font-medium text-white/80">3 · Simulate Events</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Yield Simulation */}
          <div className="space-y-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Yield Accrual</h3>
              <span className="text-[10px] text-emerald-400/50 italic">Waterfall Distribution</span>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-white/30 uppercase">Amount (USDC)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={params.yieldAmount}
                  onChange={(e) => setParams(p => ({ ...p, yieldAmount: e.target.value }))}
                  className="flex-1 bg-black/20 border border-emerald-500/20 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={accrueYield}
                  disabled={!wallet}
                  className="px-4 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Loan Lifecycle */}
          <div className="space-y-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 md:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Loan Lifecycle</h3>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-blue-400/50 italic">Disburse → Repay</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                  <span className="text-[9px] text-white/30 uppercase font-bold">Collateral:</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    ikaStatus === 'Locked' ? 'text-emerald-400' : 
                    ikaStatus === 'Pending' ? 'text-yellow-400' : 'text-rose-400'
                  }`}>
                    {ikaStatus || 'Not Attached'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-white/30 uppercase">Repay Amount (USDC)</label>
                <input
                  type="text"
                  value={params.repayAmount}
                  onChange={(e) => setParams(p => ({ ...p, repayAmount: e.target.value }))}
                  className="w-full bg-black/20 border border-blue-500/20 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <button
                onClick={disburseLoan}
                disabled={!wallet}
                className="px-4 py-1.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-200 text-xs font-semibold hover:bg-blue-500/30 transition-all disabled:opacity-40 whitespace-nowrap"
              >
                Disburse Loan
              </button>
              <button
                onClick={repayLoan}
                disabled={!wallet}
                className="px-4 py-1.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-xs font-semibold hover:bg-indigo-500/30 transition-all disabled:opacity-40 whitespace-nowrap"
              >
                Repay Loan
              </button>
            </div>
            {ikaStatus === 'Locked' && (
              <button
                onClick={liquidateCollateral}
                disabled={!wallet}
                className="w-full py-1.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-200 text-xs font-semibold hover:bg-orange-500/30 transition-all disabled:opacity-40"
              >
                Liquidate IKA Collateral
              </button>
            )}
            <p className="text-[10px] text-white/25">Disburse sends vault reserve USDC to the borrower. Repay returns USDC back into the reserve. Liquidate seizes IKA collateral after a vault default.</p>
          </div>

          {/* Default Simulation */}
          <div className="space-y-3 p-4 rounded-lg bg-rose-500/5 border border-rose-500/10">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Credit Event</h3>
              <span className="text-[10px] text-rose-400/50 italic">Loss Cascade</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/30 uppercase">Loss (USDC)</label>
                <input
                  type="text"
                  value={params.lossAmount}
                  onChange={(e) => setParams(p => ({ ...p, lossAmount: e.target.value }))}
                  className="w-full bg-black/20 border border-rose-500/20 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/30 uppercase">Severity (%)</label>
                <input
                  type="text"
                  value={params.severity}
                  onChange={(e) => setParams(p => ({ ...p, severity: e.target.value }))}
                  className="w-full bg-black/20 border border-rose-500/20 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500/50"
                />
              </div>
            </div>
            <button
              onClick={triggerDefault}
              disabled={!wallet}
              className="w-full mt-1 py-2 rounded bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 transition-all disabled:opacity-40"
            >
              Trigger Default Event
            </button>
          </div>
        </div>
      </section>

      {/* Log */}
      {log.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium text-white/50">Transaction Log</h2>
            <button
              onClick={() => setLog([])}
              className="text-[10px] text-white/30 hover:text-white/60 underline decoration-white/10 underline-offset-2"
            >
              clear
            </button>
          </div>
          <div className="max-h-48 space-y-0.5 overflow-y-auto font-mono text-xs text-white/60">
            {log.map((line, i) => (
              <div key={i} className={line.startsWith('[') && line.includes('✓') ? 'text-emerald-400/80' : line.includes('✗') ? 'text-red-400/80' : ''}>
                {line}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending Loan Applications */}
      {applications.filter(a => a.status === 'pending').length > 0 && (
        <section className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-4">
          <h2 className="text-sm font-medium text-yellow-200/80">
            4 · Pending Loan Applications ({applications.filter(a => a.status === 'pending').length})
          </h2>
          <div className="space-y-3">
            {applications
              .filter(a => a.status === 'pending')
              .map((app, idx) => {
                // Start from 1 — loan ID 0 is reserved for the admin setup/demo loan
                const nextId = 1 + applications.filter(a => a.status === 'approved').length + idx;
                return (
                  <div key={app.id} className="rounded-lg border border-yellow-500/10 bg-black/20 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs space-y-0.5">
                        <p className="font-mono text-white/70">{app.borrowerPubkey.slice(0, 16)}…</p>
                        <p className="text-white/50">{app.purpose} · {app.maturityDays} days · ${app.requestedUSDC.toLocaleString()} USDC</p>
                        <p className="text-white/30 text-[10px]">{new Date(app.submittedAt).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => originateLoanForApplicant(app.id, app.borrowerPubkey, app.requestedUSDC, app.maturityDays, nextId)}
                          disabled={!wallet}
                          className="rounded-md bg-green-500/20 border border-green-500/30 px-2.5 py-1 text-[11px] font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-40"
                        >
                          Approve & Originate
                        </button>
                        <button
                          onClick={() => reject(app.id)}
                          className="rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
