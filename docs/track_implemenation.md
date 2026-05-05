# Implementation Plan: Detailed Sidetrack Integration

This document provides a deep dive into the four "sidetrack" technologies being integrated into PRISM Protocol for the Solana Frontier Hackathon.

---

## 1. IKA Network (formerly dWallet)
**Category:** Cross-Chain Credit Infrastructure
**Goal:** Enable native BTC and RWA collateral for Solana loans.

### What it is
IKA is a decentralized MPC (Multi-Party Computation) network that allows users to create **dWallets**. These are non-custodial wallets that exist on any chain (BTC, Ethereum, etc.) but are controlled by logic on another chain (Solana). 
- **Google Search:** [Ika Network dWallet Solana](https://www.google.com/search?q=Ika+Network+dWallet+Solana)
- **Reference:** [ika.xyz](https://ika.xyz)

### Code Structure & Snippet
We will add `collateral_metadata` to the `Loan` account to store the dWallet address and verify the collateral state.

**Proposed State Change (`state.rs`):**
```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct IkaCollateral {
    pub dwallet_id: [u8; 32],     // Unique dWallet identifier
    pub chain_id: u8,             // 1 = BTC, 2 = ETH, etc.
    pub amount: u64,              // Amount locked in dWallet
    pub last_verified_ts: i64,
}

pub struct Loan {
    // ... existing fields
    pub ika_collateral: Option<IkaCollateral>,
}
```

---

## 2. Cloak
**Category:** Privacy & Confidentiality
**Goal:** Shield institutional yield distributions.

### What it is
Cloak is a privacy-first infrastructure layer for Solana that uses Zero-Knowledge Proofs (ZKP) to enable "shielded" accounts and transactions. It allows for "Batch Disbursement," where one transaction fans out to multiple recipients with confidential amounts.
- **Google Search:** [Cloak.ag Solana Privacy SDK](https://www.google.com/search?q=Cloak.ag+Solana+Privacy+SDK)
- **Reference:** [cloak.ag](https://cloak.ag)

### Code Structure & Snippet
We will implement a `confidential_payout` helper that uses the Cloak SDK to send yield from the vault to LPs.

**Proposed Integration (`confidential_disburse.rs`):**
```rust
// This is a draft of the interaction with Cloak program
pub fn confidential_payout(ctx: Context<ConfidentialPayout>, amount: u64) -> Result<()> {
    // 1. Send funds to the Cloak Shield program
    // 2. Generate a ZK proof for the disbursement list
    // 3. Execute the fan-out to shielded LP accounts
    Ok(())
}
```

---

## 3. Dune SIM (Echo)
**Category:** Real-Time Analytics
**Goal:** Power the high-fidelity protocol dashboard.

### What it is
Dune SIM is a real-time developer platform providing low-latency APIs to query Solana state (PDAs, account balances, etc.) without building a custom indexer.
- **Google Search:** [Dune Sim Solana API](https://www.google.com/search?q=Dune+Sim+Solana+API)
- **Reference:** [dune.com/sim](https://dune.com/sim)

### Code Structure & Snippet
A frontend service to fetch tranche-specific metrics directly from Dune's simulation layer.

**Proposed Implementation (`dune-service.ts`):**
```typescript
const DUNE_SIM_URL = "https://api.dune.com/api/v1/sim/solana";

export async function fetchTrancheStats(vaultId: string) {
  const response = await fetch(`${DUNE_SIM_URL}/vault/${vaultId}/tranches`, {
    headers: { "X-Dune-API-Key": process.env.DUNE_API_KEY }
  });
  return response.json(); // Returns real-time NAV and yield stats
}
```

---

## 4. Dodo Payments
**Category:** Fiat On-ramp & Global Payments
**Goal:** Borrower repayments via local fiat/stablecoins.

### What it is
Dodo Payments is a Merchant of Record (MoR) platform that supports crypto (USDC on Solana) and fiat payments. It handles tax compliance and regional payment methods (UPI in India, cards globally).
- **Google Search:** [Dodo Payments Solana Integration](https://www.google.com/search?q=Dodo+Payments+Solana+Integration)
- **Reference:** [dodopayments.com](https://dodopayments.com)

### Code Structure & Snippet
Integration in the repayment UI to generate a checkout session for the borrower.

**Proposed Integration (`repayment-component.tsx`):**
```typescript
import { DodoPayments } from "@dodopayments/sdk";

const handleRepay = async (loanId: string, amount: number) => {
  const session = await dodo.checkout.create({
    amount,
    currency: "USD",
    payment_methods: ["crypto", "upi", "card"],
    metadata: { loanId, network: "solana" }
  });
  window.location.href = session.url; // Redirect to checkout
};
```

---

## Proposed File Changes Summary

### [Component] PRISM Core (Rust)
- [MODIFY] `state.rs`: Add `IkaCollateral` and `CloakMeta` structs.
- [MODIFY] `initialize_loan.rs`: Support IKA metadata.
- [NEW] `instructions/confidential_disburse.rs`: Logic for Cloak interaction.

### [Component] PRISM App (React/TS)
- [NEW] `services/analytics/dune-sim.ts`: API wrapper.
- [NEW] `services/payments/dodo.ts`: Checkout session handler.
- [MODIFY] `components/loans/CollateralCard.tsx`: Display cross-chain assets.

## Verification Plan
1. **IKA**: Mock dWallet signatures to verify collateral lock.
2. **Cloak**: Use `npx @cloak.dev/claude-skills` to test shielded send logic.
3. **Dune**: Validate API responses against local cluster state.
4. **Dodo**: Test payment webhooks in sandbox mode.
