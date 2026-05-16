/**
 * Bags fee-stream keeper.
 *
 * Polls the Bags API for unclaimed fees on every active PRISM fee-claimer PDA,
 * then for each one:
 *   1. Builds the Bags claim transaction (SOL → fee-claimer wallet).
 *   2. Swaps the SOL to USDC via the Bags trade endpoint (or Jupiter fallback).
 *   3. Calls `repay_loan` on the existing PRISM core program to credit the loan.
 *   4. Calls `claim_and_settle_bags_fees` with a Bags-oracle attestation
 *      recording the sweep against the BagsCollateral PDA.
 *
 * Step (4) is the only on-chain accounting step — steps (1)-(3) are off-chain
 * orchestration. Keep this script's transaction signing logic minimal so the
 * production version can replace it with a hardened daemon.
 *
 * Usage:
 *   BAGS_API_KEY=... \
 *   ANCHOR_WALLET=keys/keeper.json \
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   pnpm exec tsx scripts/bags-keeper.ts --once          # single pass
 *   pnpm exec tsx scripts/bags-keeper.ts --interval=300  # loop every 300s
 *
 * Scaffold note: this file lays out the loop and resolves PDAs / fees, but
 * the actual claim + swap + on-chain settle CPIs are stubbed pending the
 * Bags SDK launch flow being exercised in scripts/launch-bags-token.ts.
 */

import {
  bagsApiConfigured,
  getClaimablePositions,
  lamportsToSol,
  getTradeQuote,
  type BagsClaimablePosition,
} from '../app/lib/bags';

interface Args {
  once: boolean;
  intervalSec: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const intervalArg = argv.find((a) => a.startsWith('--interval='));
  return {
    once: argv.includes('--once') || !intervalArg,
    intervalSec: intervalArg ? Number(intervalArg.split('=')[1]) : 0,
  };
}

const MIN_SWEEP_LAMPORTS = 100_000_000n; // 0.1 SOL — keeper threshold

async function tick(): Promise<void> {
  const ts = new Date().toISOString();
  console.log(`[${ts}] bags-keeper: pass start`);

  if (!bagsApiConfigured()) {
    console.warn('  BAGS_API_KEY not set — keeper will run against mock data.');
  }

  // Real keeper queries an on-chain index of every Active BagsCollateral PDA.
  // The scaffold reads a CSV of (fee_claimer_pda, token_mint, loan_pubkey)
  // from BAGS_KEEPER_TARGETS so we can exercise the loop without a deployed
  // program account index.
  const targets = parseTargets(process.env.BAGS_KEEPER_TARGETS ?? '');
  if (targets.length === 0) {
    console.log('  No keeper targets configured. Set BAGS_KEEPER_TARGETS.');
    return;
  }

  for (const t of targets) {
    try {
      await processTarget(t);
    } catch (err) {
      console.error(`  ✗ target ${t.feeClaimer} failed:`, err);
    }
  }

  console.log(`[${new Date().toISOString()}] bags-keeper: pass complete`);
}

interface KeeperTarget {
  feeClaimer: string;
  tokenMint: string;
  loan: string;
}

function parseTargets(raw: string): KeeperTarget[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [feeClaimer, tokenMint, loan] = row.split(':');
      if (!feeClaimer || !tokenMint || !loan) {
        throw new Error(`Malformed BAGS_KEEPER_TARGETS entry: ${row}`);
      }
      return { feeClaimer, tokenMint, loan };
    });
}

async function processTarget(t: KeeperTarget) {
  const positions = await getClaimablePositions(t.feeClaimer, t.tokenMint);
  const position = positions.find((p) => p.tokenMint === t.tokenMint);
  if (!position) {
    console.log(`  • ${shortAddr(t.feeClaimer)} — no position`);
    return;
  }

  const total = position.totalClaimableLamports;
  if (total < MIN_SWEEP_LAMPORTS) {
    console.log(
      `  • ${shortAddr(t.feeClaimer)} — ${lamportsToSol(total).toFixed(4)} SOL (below threshold)`,
    );
    return;
  }

  console.log(
    `  • ${shortAddr(t.feeClaimer)} — ${lamportsToSol(total).toFixed(4)} SOL claimable`,
  );

  // Quote SOL → USDC. In production this routes through Bags or Jupiter
  // depending on liquidity; here we just demonstrate the quote call.
  const usdc = await getTradeQuote({
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint:
      process.env.NEXT_PUBLIC_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    amount: total,
    slippageBps: 50,
  });
  console.log(
    `    quote: ${formatBigInt(total)} lamports → ${formatBigInt(usdc.outputAmount)} USDC base (route=${usdc.route})`,
  );

  // ── STUBS (Tier B+ wiring) ─────────────────────────────────────────────
  // 1. Build + send Bags claim tx (sdk.fees.createClaimTransactionsV3)
  // 2. Submit swap tx (Jupiter/Bags trade execute)
  // 3. Call `repay_loan` against the active loan
  // 4. Build attestation, sign with BAGS_ORACLE_SECRET, then call
  //    `claim_and_settle_bags_fees` with the Ed25519 precompile
  console.log('    (Tier B wiring: claim+swap+settle CPI calls are stubbed)');

  // Mark this position as the next sweep_seq + advance projected counters
  position satisfies BagsClaimablePosition;
}

function shortAddr(s: string): string {
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function formatBigInt(b: bigint): string {
  return b.toString();
}

async function main() {
  const args = parseArgs();
  if (args.once || args.intervalSec === 0) {
    await tick();
    return;
  }
  // Loop forever
  for (;;) {
    await tick();
    await new Promise((r) => setTimeout(r, args.intervalSec * 1000));
  }
}

main().catch((err) => {
  console.error('✗ bags-keeper crashed:', err);
  process.exit(1);
});
