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

// Ed25519 pubkey of the demo Encrypt FHE oracle.
// Derived from a deterministic 32-byte zero seed so the mock oracle route
// (app/api/encrypt-oracle/route.ts) and the on-chain allowlist agree.
// In production this is replaced by the real Encrypt oracle key.
export const ENCRYPT_ORACLE_PUBKEY = new PublicKey(
  process.env.NEXT_PUBLIC_ENCRYPT_ORACLE_PUBKEY ?? '4zvwRjXUKGfvwnParsHAS3HuSVzV5cA4McphgmoCtajS',
);
