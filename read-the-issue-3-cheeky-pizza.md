# Plan: Issue #3 — Production-Grade Frontend Simulation & Credit Lifecycle Harness

## Context

Issue #3 (assigned to ansu555) asks us to transform the PRISM frontend into a **high-fidelity simulation engine** for orchestrating the full structured credit lifecycle. The current dashboard page is an empty placeholder. The app shell (header, sidebar, topbar, layout) is already built. No on-chain integration exists yet in the frontend.

The harness must:
- Use **zero mock data** — all state pulled from Solana RPC
- Provide an **Identity Orchestrator** for 4 roles (Senior Investor, Junior Investor, Borrower, Admin)
- Show a **Vault State Dashboard** with live on-chain NAV, reserves, loss bucket
- Provide an **Action Panel** for role-specific transactions
- Log all balance deltas to a **Simulation Console**

Reference spec: `docs/frontend_testing.md`

---

## Critical Files

| Path | Status | Role |
|---|---|---|
| `app/(app)/dashboard/page.tsx` | EXISTS (empty placeholder) | **REPLACE** with harness |
| `components/app-shell/app-sidebar.tsx` | EXISTS | **WIRE** admin buttons |
| `app/(app)/layout.tsx` | EXISTS | no change |
| `components/providers/solana-wallet-provider.tsx` | EXISTS | no change |
| `contracts/lib/pda.ts` | **MISSING** | create (needed by tests + setup-demo) |
| `app/lib/pda.ts` | **MISSING** | create (frontend PDA helpers) |
| `app/lib/constants.ts` | **MISSING** | create (program IDs, USDC mint) |
| `app/lib/program.ts` | **MISSING** | create (Anchor program init for browser) |
| `app/lib/idl/prism_core.json` | **MISSING** | generate via `anchor build` |
| `app/lib/idl/prism_amm.json` | **MISSING** | generate via `anchor build` |

New components/hooks to create:
- `components/simulation/IdentityOrchestrator.tsx`
- `components/simulation/VaultStateDashboard.tsx`
- `components/simulation/ActionPanel.tsx`
- `components/simulation/SimulationConsole.tsx`
- `hooks/useIdentity.ts` (context + provider for current role)
- `hooks/useVaultState.ts` (React Query — vault + tranche on-chain fetch)
- `hooks/useSimulationLog.ts` (console log state)

---

## Implementation Steps

### Step 1 — Build IDL files
Run `cd contracts && anchor build` to generate `target/idl/prism_core.json` and `target/idl/prism_amm.json`.
Copy them: `cp target/idl/*.json ../app/lib/idl/`

### Step 2 — Create `contracts/lib/pda.ts`
This file is imported by `contracts/tests/prism-core.ts`, `prism-amm.ts`, and `contracts/scripts/setup-demo.ts` but doesn't exist. Create it using the exact helper signatures from `docs/12-reference-card.md §2.1`.

Exports: `getConfigPda`, `getVaultPda`, `getTranchePda`, `getTrancheMintPda`, `getVaultReservePda`, `getLossBucketPda`, `getLoanPda`, `getCreditEventPda`, `getPoolPda`, `getPoolTrancheReservePda`, `getPoolQuoteReservePda`, `getLpMintPda`, `TrancheKind` enum.

Program IDs:
- `PRISM_CORE_PROGRAM_ID = "Dg1PpRKjMJsGMFxPPHix65TGbma861JiervB7MtZeEQP"`
- `PRISM_AMM_PROGRAM_ID = "9jzqUXjdq6F13Tu6kWYg5d7iuJNEaCuCebNpBxnijUG"`

### Step 3 — Create `app/lib/constants.ts` + `app/lib/pda.ts`
Copy the same helpers into the frontend lib. Add `VAULT_ID = 0` and `USDC_MINT` devnet address as constants.

### Step 4 — Create `app/lib/program.ts`
Browser-side Anchor program factory. Uses `useConnection()` + passed keypair as `NodeWallet` to construct `AnchorProvider` and `Program<PrismCore>` / `Program<PrismAmm>` instances from the IDL files.

```ts
// Signature
export function buildPrograms(connection: Connection, signer: Keypair): {
  core: Program<PrismCore>;
  amm: Program<PrismAmm>;
}
```

### Step 5 — Create `hooks/useIdentity.ts`
React context that manages the currently active role. Loads keypairs embedded from `keys/*.json` (imported as static JSON — devnet only, already committed). Exposes:

```ts
interface IdentityContext {
  role: "admin" | "senior" | "junior" | "borrower";
  keypair: Keypair;
  setRole: (r: Role) => void;
}
```

Keypair sources (from `keys/` — committed devnet keys):
- `admin` → `keys/admin.json`
- `senior` → `keys/lpPrime.json`
- `junior` → `keys/lpAlpha.json`
- `borrower` → `keys/borrower.json`

### Step 6 — Create `components/simulation/IdentityOrchestrator.tsx`
A role-switcher banner at the top of the dashboard. Renders 4 role cards (Admin, Senior Investor, Junior Investor, Borrower) with SOL + USDC balance for each, highlighting the active role. Clicking a card calls `setRole()`.

### Step 7 — Create `hooks/useVaultState.ts`
React Query hook (`queryKey: ["vault", vaultId]`, `refetchInterval: 5000`) that fetches:
- `Vault` PDA account data (total assets, state, outstanding principal)
- `VaultReserve` token account balance
- `LossBucket` token account balance
- Per-tranche: `Tranche` PDA data (total_assets, total_shares, nav_q) for Prime/Core/Alpha

Uses `getVaultPda`, `getTranchePda`, `getVaultReservePda`, `getLossBucketPda` from `app/lib/pda.ts`. Computes `navPerShare = tranche.total_assets / tranche.total_shares` (Q64.64 → float conversion).

### Step 8 — Create `components/simulation/VaultStateDashboard.tsx`
Live metrics panel with auto-refresh. Shows:
- Vault Reserve (USDC) — token account balance
- Loss Bucket Balance (USDC)
- Outstanding Principal (from Vault account)
- Per-tranche card: NAV per share, Total Assets, Total Shares, TVL
- Color coding: Prime=blue, Core=yellow, Alpha=red

Uses `useVaultState()` hook. Loading/error states handled with skeleton + toast.

### Step 9 — Create `hooks/useSimulationLog.ts`
In-memory log store (array of `LogEntry`). Exposes `addEntry(entry)` and the log array. Each `LogEntry` captures:
```ts
interface LogEntry {
  timestamp: string;
  action: string;
  role: string;
  deltas: Record<string, { before: string; after: string; delta: string }>;
  navSnapshot: string;
}
```
Formatted to match the spec in `docs/frontend_testing.md §5`.

### Step 10 — Create `components/simulation/ActionPanel.tsx`
Role-aware transaction panel. Shows different forms based on active role:

| Role | Available actions |
|---|---|
| Senior Investor | Deposit (USDC → Prime tranche), Withdraw (Prime shares → USDC) |
| Junior Investor | Deposit (USDC → Alpha tranche), Withdraw (Alpha shares → USDC) |
| Borrower | Disburse Loan, Repay Loan |
| Admin | Accrue Yield, Trigger Credit Event (50% loss), Initialize (first-time setup check) |

Each action:
1. Snapshots balances before tx
2. Sends tx using `buildPrograms(connection, keypair)` — all instructions per `contracts/tests/prism-core.ts` as reference
3. Awaits `commitment: "confirmed"`
4. Snapshots balances after tx
5. Calls `addEntry()` to write delta to console
6. Surfaces errors via `sonner` toast (matching `CLAUDE.md` convention)

All mutations use `useMutation` from React Query.

### Step 11 — Create `components/simulation/SimulationConsole.tsx`
Sticky bottom panel (collapsible). Renders log entries from `useSimulationLog()` in reverse-chronological order. Each entry shows formatted delta table matching the `[SIMULATION LOG]` spec from `docs/frontend_testing.md §5`. Auto-scrolls to latest. Has "Clear" button.

### Step 12 — Replace `app/(app)/dashboard/page.tsx`
Compose the full harness page:

```
┌─────────────────────────────────────────────┐
│  IdentityOrchestrator (role switcher bar)   │
├──────────────────────┬──────────────────────┤
│                      │                      │
│  VaultStateDashboard │   ActionPanel        │
│  (metrics + NAV)     │   (role-aware forms) │
│                      │                      │
├──────────────────────┴──────────────────────┤
│  SimulationConsole (telemetry log, bottom)  │
└─────────────────────────────────────────────┘
```

Wraps children with `IdentityProvider` context.

### Step 13 — Wire admin sidebar buttons (`components/app-shell/app-sidebar.tsx`)
Connect the three stub buttons to trigger actions via the simulation context:
- **Trigger Yield** → calls `accrue_yield` instruction (Admin role required, show toast if wrong role)
- **Trigger Default** → calls `trigger_credit_event` with 50% loss
- **Run Market Reaction** → calls AMM swap sequence (sell impaired Alpha tokens for USDC)

---

## Reusable Patterns Found

- All 56 shadcn/ui components at `components/ui/` — use `Card`, `Badge`, `Button`, `Input`, `Select`, `Skeleton`, `Tabs`
- `sonner` already installed — use for all error/success toasts
- `@tanstack/react-query` already installed — use `useQuery` / `useMutation` per `CLAUDE.md`
- `useConnection` + `useWallet` from `@solana/wallet-adapter-react` — already wired in layout
- PDA derivation pattern fully documented in `docs/12-reference-card.md §2.1`
- Instruction call patterns available in `contracts/tests/prism-core.ts` (reference for exact account ordering)

---

## Verification

1. Run `anchor build` in `contracts/` — confirms IDL generation works
2. Run `anchor test` — confirms 15/15 tests pass (prerequisite per issue)
3. Start the dev server: `npm run dev` in app root
4. In browser, open `/dashboard`
5. Verify Identity Orchestrator shows 4 roles with correct addresses
6. Switch to Admin role → click "Trigger Yield" in sidebar → verify SimulationConsole logs delta
7. Switch to Senior Investor → Deposit 1000 USDC to Prime → verify NAV display updates
8. Switch to Junior Investor → Deposit 500 USDC to Alpha
9. Switch to Admin → Trigger Default (50% loss) → verify Alpha NAV drops to 0, Prime stays at 1.0
10. Verify capital conservation: sum of wallet balances + vault reserve = constant throughout
