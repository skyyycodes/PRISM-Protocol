# PRISM Protocol — Architecture Overview

> Visual diagrams live in `docs/`. Open them in a browser:
> - `docs/architecture-diagram.html` — investor-facing overview (high-level)
> - `docs/technical-architecture.html` — full technical map (accounts, PDAs, instructions, CPI)
> - `docs/flow-diagrams.html` — tabbed user flow diagrams (investor / borrower / collateral lock)

---

## What PRISM Is

PRISM is a structured credit protocol on Solana. It lets a pool of capital be deployed to real-world borrowers (SMEs, invoice financiers) and distributes the yield back to investors through a risk-tiered waterfall. Investors deposit USDC into one of three tranches and receive SPL tokens representing their position. Those tokens trade on an on-chain AMM.

---

## Capital Stack

| Tranche | Token | APY Target | Loss Priority | Yield Priority |
|---------|-------|-----------|---------------|----------------|
| Prime | `pPRIME` | 5% | Last (most protected) | First (paid first) |
| Core | `pCORE` | 8% | Second | Second |
| Alpha | `pALPHA` | 15% | First (first-loss) | Last (residual) |

Every investor is in the **same pool of loans**. Tranching determines payment order, not which loans your capital funds.

---

## Yield Waterfall (top-down)

```
Borrower repayment enters vault
        │
        ▼
  ┌─── Prime ───┐  ← fills to 5% APY target first
  └──────┬──────┘
         │ overflow
         ▼
  ┌─── Core ────┐  ← fills to 8% APY target second
  └──────┬──────┘
         │ overflow
         ▼
  ┌─── Alpha ───┐  ← receives everything left (can exceed 15%)
  └─────────────┘
```

## Loss Cascade (bottom-up)

```
Default loss
        │
        ▼
  ┌─── Alpha ───┐  ← absorbs first (wiped first)
  └──────┬──────┘
         │ overflow
         ▼
  ┌─── Core ────┐  ← absorbs only if Alpha = 0
  └──────┬──────┘
         │ overflow
         ▼
  ┌─── Prime ───┐  ← absorbs only if both wiped
  └─────────────┘
```

---

## On-Chain Programs

### `prism_core` — Credit Engine
Program ID: `CRzsHoHgdrK7HC2GoGsfxiEJtHP2sPSWY7SgrwqK9ao4`

**Accounts (PDAs)**

| Account | Seeds | Key Fields |
|---------|-------|------------|
| `GlobalConfig` | `["config2"]` | admin, usdc_mint, paused, oracle_allowlist |
| `Vault` | `["vault", vault_id: u32 LE]` | total_deposits, total_loaned, state: VaultState, last_yield_timestamp |
| `VaultReserve` | `["reserve", vault]` | SPL token account holding USDC |
| `LossBucket` | `["loss_bucket", vault]` | SPL token account (first-loss reserve) |
| `Tranche` | `["tranche", vault, kind: u8]` | total_assets, total_supply, nav_per_share_q (Q64.64), target_apy_bps |
| Tranche Mint | `["mint", vault, kind: u8]` | SPL mint authority = Vault PDA |
| `Loan` | `["loan", vault, loan_id: u32 LE]` | principal, apr_bps, maturity_ts, state: LoanState, total_repaid |
| `CreditEvent` | `["credit_event", vault, seq: u32 LE]` | event_type, loss_amount, severity_bps |
| `IkaCollateral` | `["ika_collateral", loan]` | dwallet_id, chain_id, collateral_amount_usd, status: CollateralStatus |
| `EncryptLoanHealth` | `["encrypt_health", loan]` | score_commitment, encrypt_oracle, status |
| `CloakPayoutRecord` | `["cloak_payout", vault]` | batch_id, total_shielded_amount, status |

**Instructions**

Setup: `initialize_global_config` · `initialize_vault` · `initialize_vault_reserves` · `initialize_vault_loss_bucket` · `initialize_tranche` · `initialize_loan` · `pause` · `unpause` · `reactivate_vault`

Core flow: `deposit(tranche_kind, usdc_amount)` · `withdraw(tranche_kind, share_amount)` · `accrue_yield(yield_amount)` · `disburse_loan()` · `repay_loan(amount)`

Credit: `trigger_credit_event(event_type, loss_amount, severity_bps)`

IKA: `attach_ika_collateral` · `verify_ika_collateral` · `verify_and_disburse` · `release_ika_collateral` · `liquidate_ika_collateral`

Encrypt: `attach_encrypt_score` · `verify_encrypt_default`

Cloak: `record_cloak_payout`

**Key invariant**
```
VaultReserve.amount == Σ(tranche.total_assets for all 3 tranches)
```

NAV uses Q64.64 fixed-point (`u128`, `Q64_ONE = 1 << 64`). All NAV math goes through `math::q` — no raw arithmetic.

---

### `prism_amm` — Secondary Market
Program ID: `7hbMRBwXF13fqqL8HGsgPrAakv21YoQz2KjtBpDTrRXf`

One pool per tranche token. Constant-product formula: `x · y = k`. Default fee: 30 bps (0.3%).

**Accounts (PDAs)**

| Account | Seeds | Key Fields |
|---------|-------|------------|
| `AmmPool` | `["amm", tranche_mint]` | tranche_mint, quote_mint, tranche_reserve, quote_reserve, lp_mint, fee_bps |
| tranche_reserve | `["amm_tranche", tranche_mint]` | SPL token account |
| quote_reserve | `["amm_quote", tranche_mint]` | SPL token account (USDC) |
| lp_mint | `["amm_lp", tranche_mint]` | LP token mint |

**Instructions**

`initialize_pool(fee_bps)` · `initialize_pool_reserves()` · `add_liquidity(tranche_amount, quote_amount, min_lp_out)` · `remove_liquidity(lp_amount, min_tranche_out, min_quote_out)` · `swap(amount_in, min_amount_out, direction)`

`direction=0` = buy tranche token with USDC. `direction=1` = sell tranche token for USDC.

AMM price diverges from NAV under stress — this is intentional. It provides a real-time market signal for pool credit quality independent of the on-chain NAV accounting.

---

## NAV Model

Tranche tokens use NAV-per-share accounting (like a mutual fund), not rebasing.

```
nav_per_share_q = total_assets / total_supply   (Q64.64)

On deposit:   shares_minted = usdc_amount / nav_per_share_q
On yield:     total_assets ↑  →  nav_per_share_q ↑  (token count unchanged)
On loss:      total_assets ↓  →  nav_per_share_q ↓  (token count unchanged)
On withdraw:  usdc_out = shares_burned × nav_per_share_q
```

A user's P&L is entirely captured in NAV appreciation or depreciation. No rebasing, no periodic payments.

---

## Investor Flow

```
1. Choose tranche (Prime / Core / Alpha) based on risk appetite
2. deposit(tranche_kind, usdc_amount)
   → CPI: token::transfer user→vault_reserve
   → CPI: token::mint_to (pPRIME / pCORE / pALPHA to user)
3. Wait: accrue_yield runs waterfall → nav_per_share_q ↑
   [possible: trigger_credit_event → loss cascade → nav ↓]
4. Exit via:
   A. withdraw(tranche_kind, share_amount)
      → CPI: token::burn · token::transfer vault_reserve→user
      → exit at current NAV · vault must have liquidity
   B. AMM swap(amount_in, min_out, direction=1)
      → sell tranche tokens at market price · instant exit
      → price may differ from NAV (discount in distress)
```

---

## Borrower Flow

```
1. Apply off-chain (credit assessment)
2. Admin: initialize_loan(principal, apr_bps, maturity_ts, borrower)
   → Loan PDA created · state: Originated

3. Borrower: DKG on IKA Network (Sui) → dwallet_id
4. Transfer BTC/ETH to IKA threshold address
5. IKA oracle signs 81-byte attestation
6. Borrower: attach_ika_collateral(dwallet_id, chain_id, collateral_amount_usd, oracle_pubkey)
   → IkaCollateral PDA · status: Pending

7. Borrower sends tx:
   ix[0]: Ed25519SigVerify (oracle_pubkey, oracle_sig, attestation_msg)
   ix[1]: verify_ika_collateral  (reads Sysvar::Instructions to confirm ix[0])
   → IkaCollateral.status: Locked

8. verify_and_disburse() [atomic] OR admin: disburse_loan()
   → CPI: token::transfer vault_reserve→borrower_usdc_ata
   → Loan.state: Active

9. repay_loan(amount) — periodic
   → Loan.total_repaid += amount · interest → yield waterfall

10A. Full repayment:
    → Loan.state: Repaid
    → release_ika_collateral()  →  IkaCollateral.status: Released
    → IKA MPC releases key, borrower can move BTC/ETH

10B. Default:
    → trigger_credit_event(loss_amount, severity_bps)
    → CreditEvent PDA created · loss cascade on tranches
    → liquidate_ika_collateral()  →  IkaCollateral.status: Liquidated
    → off-chain seizure via IKA node coordination
```

---

## IKA Collateral Architecture

### Why two instructions in one tx?

Solana's Ed25519 native program is a precompile that runs before any user program. Its result is stored in `Sysvar::Instructions`. The `verify_ika_collateral` instruction (ix[1]) reads that sysvar to confirm the oracle signature was verified — it does not re-verify the signature itself. This is cheaper and uses audited Solana code.

```
Transaction:
  ix[0]: Ed25519NativeProgram.verify(oracle_pubkey, oracle_sig, attestation_msg)
  ix[1]: prism_core.verify_ika_collateral(ctx) {
    reads Sysvar::Instructions
    confirms ix[0] is Ed25519 precompile at index 0
    parses attestation_msg:
      byte  0      → chain_id: u8
      bytes 1–32   → dwallet_id: [u8; 32]
      bytes 33–40  → collateral_amount_usd: u64
      bytes 41–72  → loan_pubkey: [u8; 32]
    validates loan_pubkey matches Loan PDA
    validates oracle_pubkey in GlobalConfig.oracle_allowlist
    sets IkaCollateral.status = Locked
  }
```

Both execute atomically. If ix[0] fails, the whole tx reverts.

### CollateralStatus State Machine

```
attach_ika_collateral()          verify_ika_collateral()
        │                                  │
        ▼                                  ▼
    Pending  ──────────────────────────→  Locked
                                           │         │
                                     repaid?       default?
                                           │         │
                                           ▼         ▼
                                       Released  Liquidated
```

### Security invariants

- `oracle_pubkey` must be in `GlobalConfig.oracle_allowlist`
- `attestation_msg.loan_pubkey` must match the `Loan` PDA address
- ix[0] must immediately precede ix[1] in the same transaction
- No human (including admin) can set `IkaCollateral.status = Locked` without a valid oracle signature

### Why threshold MPC?

A multisig still requires private keys to exist somewhere. IKA's dWallet uses threshold MPC — the key is split across IKA nodes and never fully reconstructed. No single party (including the PRISM admin) can move the collateral unilaterally.

---

## Frontend Architecture

The frontend (`app/`, `components/`, `hooks/`) is a **demo simulation harness**, not a live wallet dApp.

| Module | Path | Role |
|--------|------|------|
| `useVaultState` | `hooks/useVaultState.ts` | Polls all on-chain state every 5s via React Query. Single source of truth for all UI. |
| `useIdentity` | `hooks/useIdentity.tsx` | 4 demo keypairs from `contracts/keys/` (admin / senior / junior / borrower). Role switcher for simulation. |
| `buildPrograms()` | `app/lib/program.ts` | `buildProvider(conn, keypair)` → Anchor provider → both program clients. Called with active identity keypair. |
| `pda.ts` | `app/lib/pda.ts` | All PDA derivation helpers. Mirrors `contracts/programs/prism-core/src/pda.rs` exactly. |
| `ika.ts` | `app/lib/ika.ts` | IKA Network SDK integration. `buildAttestationMsg()` layout must be byte-identical to `verify_ika_collateral.rs`. |
| `useSimulationActions` | `hooks/useSimulationActions.tsx` | `useMutation` wrappers for all admin instructions. Toast on settle. Invalidates `useVaultState`. |

All async data fetching uses React Query. All mutations use `useMutation`. All transactions wait for `commitment: "confirmed"`. All errors surface via `sonner` toast — never silent.

The wallet adapter (`useWallet`, `useConnection`) is only used in the IKA collateral flow for the borrower. The simulation harness uses identity keypairs directly.

---

## Partner Integrations

| Partner | Account | Purpose |
|---------|---------|---------|
| **IKA Network** | `IkaCollateral` | BTC/ETH threshold MPC collateral. Ed25519 attestation on Solana. |
| **Encrypt** | `EncryptLoanHealth` | FHE credit scoring. `score_commitment: [u8;32]` stored on-chain. Score stays encrypted off-chain. |
| **Cloak** | `CloakPayoutRecord` | Shielded USDC batch disbursement. `batch_id: sha256(receipt)`. |

---

## Solana Native Programs Used

| Program | Use |
|---------|-----|
| `SPL Token Program` | `token::transfer`, `token::mint_to`, `token::burn` (all via CPI) |
| `System Program` | Account creation (`create_account`) on PDA init |
| `Ed25519 Precompile` | Verifies IKA oracle signatures in `verify_ika_collateral` flow |
| `Sysvar::Instructions` | Read by `verify_ika_collateral` to introspect the transaction |
