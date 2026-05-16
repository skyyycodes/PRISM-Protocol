import { PublicKey } from '@solana/web3.js';

import prismAmmIdl from '@/app/lib/idl/prism_amm.json';
import prismCoreIdl from '@/app/lib/idl/prism_core.json';

export const PRISM_CORE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PRISM_CORE_PROGRAM_ID ?? prismCoreIdl.address,
);

export const PRISM_AMM_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PRISM_AMM_PROGRAM_ID ?? prismAmmIdl.address,
);

export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
);

export const VAULT_ID = Number.parseInt(process.env.NEXT_PUBLIC_VAULT_ID ?? '0', 10);
export const USDC_DECIMALS = 6;
export const USDC_BASE_UNITS = 1_000_000n;
export const Q64_ONE = 1n << 64n;

export enum TrancheKind {
  Prime = 0,
  Core = 1,
  Alpha = 2,
}

export const TRANCHE_CONFIG = {
  [TrancheKind.Prime]: {
    key: 'prime',
    label: 'Prime',
    tone: 'text-sky-200',
    border: 'border-sky-300/25',
    bg: 'bg-sky-400/10',
  },
  [TrancheKind.Core]: {
    key: 'core',
    label: 'Core',
    tone: 'text-amber-200',
    border: 'border-amber-300/25',
    bg: 'bg-amber-400/10',
  },
  [TrancheKind.Alpha]: {
    key: 'alpha',
    label: 'Alpha',
    tone: 'text-rose-200',
    border: 'border-rose-300/25',
    bg: 'bg-rose-400/10',
  },
} as const;

export const DEFAULT_DEMO_LOSS_AMOUNT = 6_500_000_000n;
export const DEFAULT_DEMO_YIELD_AMOUNT = 100_000_000n;
export const DEFAULT_DEMO_LOAN_PRINCIPAL = 20_000_000_000n;

// ── Protocol risk parameters (single source of truth) ─────────────────────────
export const PROTOCOL_DEFAULT_APR_PCT = 8.5;
export const PROTOCOL_MIN_COLLATERAL_RATIO = 1.2;
export const PROTOCOL_MAX_LTV_PCT = 80;
export const INSTITUTIONAL_CREDIT_LIMIT_USD = 500_000;
export const INDIVIDUAL_CREDIT_LIMIT_USD = 100_000;

// Pool display names keyed by vault id. No on-chain metadata exists for these
// yet, so they live here until a vault metadata instruction is added.
export const POOL_NAMES: Record<number, string> = {
  0: 'Institutional Stablecoin Credit',
  1: 'BTC Treasury Lending',
  2: 'Real Estate Credit Pool',
  3: 'Growth Capital Market',
};

// Ed25519 pubkey of the demo Encrypt FHE oracle.
// Derived from a deterministic 32-byte zero seed so the mock oracle route
// (app/api/encrypt-oracle/route.ts) and the on-chain allowlist agree.
// In production this is replaced by the real Encrypt oracle key.
export const ENCRYPT_ORACLE_PUBKEY = new PublicKey(
  process.env.NEXT_PUBLIC_ENCRYPT_ORACLE_PUBKEY ?? '4zvwRjXUKGfvwnParsHAS3HuSVzV5cA4McphgmoCtajS',
);

// Demo Cloak oracle pubkey (derived from deterministic 0x11... seed in
// app/api/cloak-oracle/shield_payout/route.ts). Replace with real oracle key
// for production.
export const CLOAK_ORACLE_PUBKEY = new PublicKey(
  process.env.NEXT_PUBLIC_CLOAK_ORACLE_PUBKEY ?? 'F25s3DdjXdCxYBhh2z8FBusVEMT4b9bGNFVKJi3wFoF4',
);

// Optional Cloak program id for SDK-based integrations. Current flow records
// attestation only, so this is informational unless explicitly used.
export const CLOAK_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_CLOAK_PROGRAM_ID ?? '11111111111111111111111111111111',
);

// ── Bags.fm integration ──────────────────────────────────────────────────────
// The Bags REST API base URL. Override per-environment.
export const BAGS_API_BASE_URL =
  process.env.NEXT_PUBLIC_BAGS_API_BASE_URL ?? 'https://api.bags.fm';

// Public Bags page URL for the protocol token (set after launch).
export const BAGS_TOKEN_URL =
  process.env.NEXT_PUBLIC_BAGS_TOKEN_URL ?? 'https://bags.fm';

// Solana mint of the protocol's Bags-launched token ($PRISM).
// Empty string until the launch script runs. UI uses this to gate live
// fee widgets — when empty, mock data is shown.
export const BAGS_PROTOCOL_TOKEN_MINT =
  process.env.NEXT_PUBLIC_BAGS_PROTOCOL_TOKEN_MINT ?? '';

// Ed25519 pubkey of the Bags attestation oracle. The oracle reads Bags
// API state (fee config, claimable positions, etc.) and signs the on-chain
// attestation messages consumed by `accept_bags_fee_collateral` and
// `claim_and_settle_bags_fees`. Deterministic 0x22... seed for the local
// devnet mock at /api/bags-oracle/.
export const BAGS_ORACLE_PUBKEY = new PublicKey(
  process.env.NEXT_PUBLIC_BAGS_ORACLE_PUBKEY ?? '6yzGfeqaT58TQjyTNJunc4uULP1qq6X5tNHobcGsCYxR',
);

// Conservative LTV against trailing 30-day fee revenue. The strategy doc
// flags fee streams as volatile — anchor max loan-to-value low.
export const BAGS_MAX_LTV_BPS = 3_000; // 30%
