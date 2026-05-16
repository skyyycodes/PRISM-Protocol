/**
 * Launch the $PRISM token on Bags.fm with a multi-claimer fee share.
 *
 * Fee allocation (in basis points, must total 10_000):
 *   vault PDA      7_000  (70% — routes back into the senior tranche reserve)
 *   team wallet    2_000  (20%)
 *   treasury       1_000  (10%)
 *
 * Usage:
 *   BAGS_API_KEY=...               (required for live)
 *   BAGS_LAUNCH_WALLET=...         (path to wallet json that pays + becomes payer)
 *   BAGS_TEAM_WALLET=<pubkey>      (20% share)
 *   BAGS_TREASURY_WALLET=<pubkey>  (10% share)
 *   PRISM_TOKEN_NAME='PRISM Protocol'
 *   PRISM_TOKEN_SYMBOL=PRISM
 *   PRISM_TOKEN_IMAGE=https://prismprotocol.dev/og.png
 *   pnpm exec tsx scripts/launch-bags-token.ts          # dry run (no signing)
 *   pnpm exec tsx scripts/launch-bags-token.ts --commit  # broadcast
 *
 * In dry-run mode the script logs what *would* be sent and exits 0. This is
 * the only way to run safely while we don't have a funded launch wallet —
 * see docs/bags-hackathon-strategy.md Tier A.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Keypair, PublicKey } from '@solana/web3.js';

// Local lazy import — these helpers live under app/lib so the front-end
// also derives the same PDAs.
import { getVaultPda, getBagsFeeClaimerPda } from '../app/lib/pda';
import { VAULT_ID } from '../app/lib/constants';

// ── Config ──────────────────────────────────────────────────────────────────

const COMMIT = process.argv.includes('--commit');

const FEE_SPLIT_BPS = {
  vault: 7_000,
  team: 2_000,
  treasury: 1_000,
} as const;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`✗ Missing required env var: ${key}`);
    process.exit(1);
  }
  return v;
}

function readKeypair(envKey: string): Keypair {
  const p = requireEnv(envKey);
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  const raw = JSON.parse(readFileSync(abs, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

function readPubkey(envKey: string): PublicKey {
  return new PublicKey(requireEnv(envKey));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`PRISM Bags launch — ${COMMIT ? 'COMMIT' : 'DRY RUN'}`);
  console.log('────────────────────────────────────────────────────────────');

  if (!process.env.BAGS_API_KEY) {
    console.warn('⚠ BAGS_API_KEY not set — running in pure dry-run / scaffold mode.');
  }

  // Resolve fee claimers
  const tokenName = process.env.PRISM_TOKEN_NAME ?? 'PRISM Protocol';
  const tokenSymbol = process.env.PRISM_TOKEN_SYMBOL ?? 'PRISM';
  const tokenImage = process.env.PRISM_TOKEN_IMAGE ?? 'https://prismprotocol.dev/og.png';

  const [vaultPda] = getVaultPda(VAULT_ID);
  // We use the same fee-claimer PDA used for creator collateral; for the protocol
  // launch we reuse the seed pattern with the launch wallet as the "creator".
  const launchWallet = COMMIT ? readKeypair('BAGS_LAUNCH_WALLET') : null;
  const launchPubkey = launchWallet
    ? launchWallet.publicKey
    : new PublicKey('11111111111111111111111111111111');

  const [feeClaimerPda] = getBagsFeeClaimerPda(vaultPda, launchPubkey);
  const teamWallet = COMMIT ? readPubkey('BAGS_TEAM_WALLET') : new PublicKey('11111111111111111111111111111111');
  const treasury = COMMIT
    ? readPubkey('BAGS_TREASURY_WALLET')
    : new PublicKey('11111111111111111111111111111111');

  const totalBps =
    FEE_SPLIT_BPS.vault + FEE_SPLIT_BPS.team + FEE_SPLIT_BPS.treasury;
  if (totalBps !== 10_000) {
    throw new Error(`Fee split must sum to 10000 bps, got ${totalBps}`);
  }

  console.log(`Token:        ${tokenName} (${tokenSymbol})`);
  console.log(`Image:        ${tokenImage}`);
  console.log(`Vault PDA:    ${vaultPda.toBase58()}`);
  console.log(`Launch payer: ${launchPubkey.toBase58()}`);
  console.log('Fee claimers:');
  console.log(`  vault PDA     ${feeClaimerPda.toBase58()}  ${FEE_SPLIT_BPS.vault} bps`);
  console.log(`  team          ${teamWallet.toBase58()}  ${FEE_SPLIT_BPS.team} bps`);
  console.log(`  treasury      ${treasury.toBase58()}  ${FEE_SPLIT_BPS.treasury} bps`);
  console.log('────────────────────────────────────────────────────────────');

  if (!COMMIT) {
    console.log('Dry run only. Re-run with --commit to broadcast.');
    console.log('When committing, ensure:');
    console.log('  - BAGS_API_KEY is set');
    console.log('  - BAGS_LAUNCH_WALLET keypair has >= 0.2 SOL');
    console.log('  - BAGS_TEAM_WALLET / BAGS_TREASURY_WALLET are real wallets you control');
    return;
  }

  // Live path — exercise the real SDK. Dynamic import so the package only
  // resolves when actually launching.
  // @ts-expect-error — @bagsfm/bags-sdk is an optional runtime dependency.
  const bagsSdkMod = await import('@bagsfm/bags-sdk').catch(() => null);
  if (!bagsSdkMod) {
    console.error(
      '✗ @bagsfm/bags-sdk not installed. Run: pnpm add -D @bagsfm/bags-sdk',
    );
    process.exit(1);
  }
  const { BagsSDK } = bagsSdkMod as { BagsSDK: new (cfg: unknown) => unknown };

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';

  const sdk = new BagsSDK({
    apiKey: process.env.BAGS_API_KEY!,
    rpcUrl,
  }) as any;

  // 1. Token metadata
  const metadata = await sdk.tokenLaunch.createTokenInfoAndMetadata({
    name: tokenName,
    symbol: tokenSymbol,
    image: tokenImage,
    description:
      'On-chain credit infrastructure for the Bags creator economy. ' +
      'Tranches of programmable credit risk backed by Bags fee streams.',
    socials: {
      twitter: process.env.PRISM_TOKEN_TWITTER ?? '',
      website: 'https://prismprotocol.dev',
    },
  });
  console.log('✓ Token metadata created');

  // 2. Fee share config — multi-claimer
  const feeConfig = await sdk.config.createBagsFeeShareConfig({
    payer: launchWallet!.publicKey,
    baseMint: metadata.mint,
    claimersArray: [feeClaimerPda, teamWallet, treasury],
    basisPointsArray: [FEE_SPLIT_BPS.vault, FEE_SPLIT_BPS.team, FEE_SPLIT_BPS.treasury],
  });
  console.log('✓ Fee share config created');

  // 3. Launch transaction
  const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
    payer: launchWallet!.publicKey,
    tokenInfo: metadata,
    feeShareConfig: feeConfig,
  });
  console.log('✓ Launch transaction built');

  // 4. Sign + send
  const sig = await sdk.transactions.sendBundled({
    transaction: launchTx,
    signer: launchWallet,
  });
  console.log(`✓ Launched! tx: ${sig}`);
  console.log(`  mint: ${metadata.mint.toBase58()}`);
  console.log('');
  console.log('Update .env.local:');
  console.log(`  NEXT_PUBLIC_BAGS_PROTOCOL_TOKEN_MINT=${metadata.mint.toBase58()}`);
  console.log(`  NEXT_PUBLIC_BAGS_TOKEN_URL=https://bags.fm/${metadata.mint.toBase58()}`);
}

main().catch((err) => {
  console.error('✗ Launch failed:', err);
  process.exit(1);
});
