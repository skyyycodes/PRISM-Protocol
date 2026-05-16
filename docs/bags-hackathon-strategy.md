# PRISM Protocol — Bags Hackathon Strategy

**Hackathon:** The Bags Hackathon (bags.fm/hackathon)
**Pool:** $4M total — $1M in grants split across 100 winners ($10K–$100K each), $3M continuation fund.
**Format:** Rolling applications, ranked by *real onchain traction* and *product traction*.
**Verification:** Onchain — team, contract, and revenue must be publicly verifiable.
**Decision date:** TBD by team. Apply early so we sit in the first cohort review.

---

## TL;DR

| Question | Answer |
|---|---|
| How many tracks do we apply to? | **5 tracks**, one submission spanning all (projects can span categories per the rules) |
| Which tracks? | DeFi (primary), Fee Sharing, Bags API, Privacy, Social Finance |
| Skipping which? | AI Agents, Claude Skills, Payments, Other |
| What's the minimum to qualify? | A Bags token + one Bags API integration + verified team + real onchain revenue |
| What's the minimum *credible* submission? | Above, plus the Creator-Credit product (borrowers pledge Bags fee streams as collateral) |
| What ranks us higher? | Deep integration: tranche tokens launched through Bags, vault PDA as fee claimer, live SOL→USDC fee swap into NAV |
| How many implementation items? | **22 discrete items** below, grouped into Tier A (qualifier, 6), Tier B (credible, 9), Tier C (rank-higher, 7) |

Pitch line:

> **PRISM is credit infrastructure for the Bags creator economy. Creators borrow USDC against their future Bags fees; LPs underwrite that risk through three tradable tranches.**

This converts every Bags token's 1% perpetual fee stream into bankable collateral — which is exactly the kind of thing the hackathon's "expand fee sharing" framing is asking for.

---

## Bags primer (what we're building on)

Bags.fm is a Solana launchpad with fee sharing baked into the token itself:

- **Creators earn 1% of all trading volume on their token, forever.** Paid in SOL.
- **Fee shares are programmable.** Up to 100 fee claimers per token, allocated in basis points (must total 10,000). Claimers can be wallets *or* a `partnerConfig` PDA.
- **REST API + TypeScript SDK** (`@bagsfm/bags-sdk`) exposes token launch, fee config, trade quote, swap, claim, partner program, and lifetime-fees endpoints. (Quoted scopes from [docs.bags.fm](https://docs.bags.fm))
- **Distribution to top 100 holders** happens automatically every 24h when a token has ≥10 SOL unclaimed.

The *critical* primitive for us: a **fee claimer can be a PDA**. That means a PRISM vault PDA can be set as a fee claimer on a creator's Bags token. The protocol claims fees on behalf of the borrower, swaps SOL→USDC, and applies them to the loan. This is the keystone — without PDA fee claimers, the creator-credit product needs a trusted operator.

### Bags API surface we'll touch

| Endpoint / method | What we use it for |
|---|---|
| `sdk.tokenLaunch.createTokenInfoAndMetadata` | Launch the $PRISM token |
| `sdk.config.createBagsFeeShareConfig` | Configure fee splits (vault PDA + team + treasury) |
| `sdk.tokenLaunch.createLaunchTransaction` | Build the launch tx |
| `getTokenCreators` (`/token-launch/creator/v3`) | Verify a creator's identity and royaltyBps when underwriting |
| `getTokenLifetimeFees` | Historical fee revenue → collateral valuation |
| `getClaimablePositions` | Current unclaimed fees → mark-to-market |
| `getClaimTransactions` (v3) | Claim fees into the PRISM PDA |
| `getTokenClaimEvents` / `getTokenClaimStats` | Cash-flow oracle inputs |
| `getTradeQuote` + create swap tx | Optional: SOL→USDC inside the protocol |
| `createPartnerConfig` | Register PRISM as a Bags partner (long-tail platform fee) |

---

## Track-by-track fit

The hackathon lets a single project span multiple categories. We're going to actually fit, not stretch.

### 1. DeFi — primary track (strongest fit)

PRISM is structured credit on Solana. Three risk tranches, NAV math, constant-product AMM for tranche tokens, yield waterfall, loss cascade. This is the obvious home category.

**What's already built:** `prism_core` + `prism_amm` Anchor programs, NAV in Q64.64, tranche SPL tokens, dashboard, IKA collateral flow.

**What we need to add for Bags:** the Creator-Credit product loop (see Tier B below).

### 2. Fee Sharing — co-primary (deepest narrative)

The hackathon page explicitly calls out *"tools that expand fee sharing"* as a focus area. Our angle:

- PRISM doesn't just *consume* Bags fee sharing — it **securitizes** it. We turn a fee stream into a credit-rated tradable instrument.
- The protocol's own $PRISM token is launched on Bags with fee sharing routed to the vault PDA, the team, and a treasury claimer.
- LPs in the senior tranche effectively own a senior claim on a diversified portfolio of Bags fee streams.

### 3. Bags API — track qualifier

"Must use Bags" is a hard requirement (rule #4). We hit it three ways:

- Launch a Bags token ($PRISM).
- Use the Bags API in product flow (read fee streams as oracle input, swap SOL→USDC via Bags trade endpoints).
- Optionally route pPRIME/pCORE/pALPHA liquidity through Bags pools instead of (or alongside) our internal AMM.

Deeper API surface usage = higher ranking, per the rules.

### 4. Privacy — bonus track (already built)

IKA dWallet collateral is already implemented (`app/lib/ika.ts`, `verify_ika_collateral.rs`, Ed25519 precompile pattern). We re-pitch it for this hackathon:

> *Creators in some jurisdictions don't want their wallet's full fee history exposed to underwriters. PRISM uses IKA threshold MPC so borrowers prove fee-stream ownership without revealing their full Bags portfolio.*

Zero net new code. Just narrative + a section in the application.

### 5. Social Finance — soft fit, free track add

Creator credit *is* social finance — a creator's social platform identity (Twitter/Kick/GitHub, which Bags already resolves) becomes a creditworthy attribute. Apply under this category too; it costs nothing and broadens our scoring surface.

### Skipped tracks

| Track | Why skip |
|---|---|
| AI Agents | Forced fit. We'd have to invent an agent. Costs more time than the marginal track value |
| Claude Skills | Tempting (low effort), but a "deploy a vault" skill is gimmicky without real users. Park for v2 |
| Payments | No payment rail in PRISM today. Stretch |
| Other | Catchall; no need when we have 5 real categories |

---

## Implementation plan — 22 items, three tiers

### Tier A — Qualifier (6 items, ~4–5 days)

These are non-negotiable. Without them, the application gets rejected on rule #4 ("must use Bags") and rule #5 ("must deploy a working product with real users").

| # | Item | Touchpoints |
|---|---|---|
| A1 | Launch $PRISM token via Bags SDK on mainnet | New script `scripts/launch-bags-token.ts`; calls `createTokenInfoAndMetadata` + `createBagsFeeShareConfig` + `createLaunchTransaction` |
| A2 | Configure fee share: 70% vault PDA / 20% team / 10% treasury | Same script. Vault PDA derived from `getVaultReservePda(vault)` |
| A3 | Register a Bags partner config for PRISM | `createPartnerConfig` — long-tail platform fees from any tokens launched through our UI |
| A4 | Add `@bagsfm/bags-sdk` + `BAGS_API_KEY` env var; wire `app/lib/bags.ts` | New file mirroring `app/lib/ika.ts`. Exports typed wrappers for the SDK calls we actually use |
| A5 | One user-visible Bags API flow on the dashboard | Read $PRISM lifetime fees on the marketing page; show "fees claimed to date" widget |
| A6 | Verified team & contract: KYC team identity, publish mainnet program IDs, point Bags verifier at our contracts | Doc + on-page links; update [docs/before-mainnet.md](before-mainnet.md) checklist |

### Tier B — Credible submission (9 items, ~10–14 days)

This is the actual product loop. Without it, we have a Bags token glued to an unrelated DeFi project — judges will see through that.

| # | Item | Touchpoints |
|---|---|---|
| B1 | New Anchor instruction `accept_bags_fee_collateral` on `prism_core` | `contracts/programs/prism-core/src/instructions/accept_bags_fee_collateral.rs` |
| B2 | New account `BagsCollateral` (tranche-mint, fee-claimer PDA, last-claimed amount, valuation cap) | Add to `contracts/programs/prism-core/src/state/` |
| B3 | New PDA: `["bags_collateral", vault, creator_wallet]` — owns the fee claim rights for the borrower | Mirror in [app/lib/pda.ts](../app/lib/pda.ts) and `contracts/lib/pda.ts` |
| B4 | New Anchor instruction `claim_and_settle_bags_fees` — keeper-callable; pulls SOL fees, swaps SOL→USDC, applies to loan principal | Calls Jupiter or Bags swap CPI; updates `Loan` account |
| B5 | Off-chain keeper service (`scripts/bags-keeper.ts`) — polls `getClaimablePositions` every N minutes, builds + sends claim tx when threshold hit | New Node process; runs alongside Next.js |
| B6 | New `/creator-credit` route in `app/(app)/` — borrower wizard: connect wallet → fetch `getTokenCreators` + `getTokenLifetimeFees` → quote a USDC loan → assign vault PDA as Bags fee claimer → sign | New page + new component dir `components/creator-credit/` |
| B7 | Fee-stream valuation oracle: rolling 30-day average from `getTokenClaimStats` → max-LTV USDC quote | New module `app/lib/bags-valuation.ts` |
| B8 | Surface Bags-backed loans on the existing dashboard's loan list | Extend `useVaultState` to include a Bags-collateral view; new component in `components/simulation/` |
| B9 | Real users + real revenue: 5–10 actual Bags creators using the product; document tx hashes in the submission | Outreach via Bags Discord; coordinate with creators we already know |

### Tier C — Rank-higher (7 items, optional — pursue after B is stable)

These are the items that turn an accepted application into a top-tier grant.

| # | Item | Touchpoints |
|---|---|---|
| C1 | Launch pPRIME / pCORE / pALPHA *through Bags* — tranche tokens get native Bags pools with fee sharing back to the vault | Replace internal AMM seeding with Bags `createLaunchTransaction`; keep internal AMM as fallback per the closed-loop demo |
| C2 | Loss cascade reconciliation when Bags-backed loans default — tranche absorbs forgone future fees in addition to principal loss | Extend `trigger_credit_event` math to handle fee-stream collateral |
| C3 | Dedicated "Creator Credit Vault" (vault_id = 1) — segregated from the main demo vault, holds only Bags-collateralized loans | New vault config; updates to setup-demo script |
| C4 | Live dashboard panel: "Bags fees claimed into NAV in the last 24h" | New component reading `getTokenClaimEvents` |
| C5 | Dune dashboard for protocol-level metrics: TVL, active loans, fees swept, defaults — public link for the application | Dune query + embed on landing page |
| C6 | Publish a `launch-prism-creator-vault` Claude skill (skillkit.io / Bags skill registry) | Single skill file mirroring `bags` skill structure |
| C7 | IKA privacy storyline tightened — borrower can prove fee-stream ownership without revealing wallet history | Already built; just a narrative + screenshot for the app |

---

## Concrete file/code deltas (Tier A + B)

```
prism-protocol/
├── app/
│   ├── (app)/
│   │   └── creator-credit/page.tsx          ← B6 borrower wizard
│   ├── lib/
│   │   ├── bags.ts                          ← A4 typed SDK wrappers
│   │   └── bags-valuation.ts                ← B7 collateral oracle
│   └── api/
│       └── bags-webhook/route.ts            ← B5 keeper trigger (optional)
├── components/
│   └── creator-credit/                      ← B6 wizard components
│       ├── BagsTokenSelector.tsx
│       ├── FeeStreamPreview.tsx
│       ├── LoanQuoteCard.tsx
│       └── AssignFeeClaimerStep.tsx
├── contracts/
│   ├── programs/prism-core/src/
│   │   ├── instructions/
│   │   │   ├── accept_bags_fee_collateral.rs  ← B1
│   │   │   └── claim_and_settle_bags_fees.rs  ← B4
│   │   ├── state/
│   │   │   └── bags_collateral.rs              ← B2
│   │   └── pda.rs                              ← B3 (add helper)
│   └── tests/
│       └── bags-collateral.ts                  ← integration tests
├── scripts/
│   ├── launch-bags-token.ts                    ← A1–A3
│   └── bags-keeper.ts                          ← B5
└── docs/
    └── bags-hackathon-strategy.md              ← (this file)
```

Estimated total: **2 new Anchor instructions, 1 new account, 1 new PDA, 1 new route, ~5 new React components, 2 new TS lib modules, 2 new scripts, 1 mainnet token launch.**

---

## Sequencing (which order to ship in)

The hackathon ranks heavily on **real traction**. Code without users won't beat code with users. So ship Tier A in the first week, Tier B in the second, then spend the rest of the cohort window driving usage.

| Week | Goal | Output |
|---|---|---|
| 1 | Tier A complete | $PRISM live on Bags mainnet with fee config; app reads & displays it; verified team page up |
| 2 | Tier B core | `accept_bags_fee_collateral` + `claim_and_settle_bags_fees` shipped; `/creator-credit` wizard live on devnet |
| 3 | Mainnet + first users | Move Bags-collateral instructions to mainnet; recruit 5+ creators; first real loans |
| 4 | Tier C selectively | C1 (tranche tokens on Bags) + C5 (Dune dashboard) for the application |
| 5+ | Growth + grow MRR | Outreach, content, blog posts on protocol_explained.md, push GitHub stars |

Apply to the hackathon at the **end of week 2**, not week 1 — rolling review means applying with a working product beats applying with a promise. The grant size is the function of traction, not the application date.

---

## Risks and gotchas

1. **Bags fees are in SOL, not USDC.** Every fee claim is implicitly an FX trade. Slippage and SOL/USDC volatility affect NAV. The keeper needs a slippage budget; loan valuation needs a SOL-price oracle (Pyth) on top of the fee-volume oracle. *Don't underestimate this.*

2. **Fee-stream collateral is volatile.** A token's trading volume can collapse in days. Loan LTVs need to be conservative (we should plan ≤30% of trailing 30-day fees → max loan). The Alpha tranche absorbs this volatility first — same loss-cascade story we already have.

3. **PDA-as-fee-claimer needs to be verified against actual Bags SDK behavior.** Docs imply `partnerConfig` is a PDA; the standard claimers array might be wallet-only. **Action: test this on devnet in week 1 before committing to the Tier B architecture.** If only the partner-config slot supports PDAs, the design becomes "PRISM is the partner; creator's loan is collateralized by the partner-config share they assigned to us." Slightly more constrained but still works.

4. **Verified onchain (rule #3).** Demo keypairs in `contracts/keys/` are devnet-only and committed to the repo. Mainnet team identity and treasury need real, custodied keys. Update [docs/before-mainnet.md](before-mainnet.md) before launching $PRISM.

5. **Closed-loop demo doesn't satisfy "real users / real transactions" (rule #5).** Tier B has to actually disburse USDC to creators and apply real claimed fees to real loans. This is the biggest delta vs. our current demo and the riskiest line item.

6. **Bags rate limits.** 1,000 req/hr per user + per IP. The keeper polling cadence and the front-end fee preview both need to share cache. Add a small Redis (or just an in-memory LRU in the Next.js API layer) to avoid hitting limits during a recording demo.

7. **Jurisdiction.** Lending against future revenue may have securities implications. For the hackathon, scope as utility / programmable credit primitive, not as a regulated lending product. Coordinate with [docs/before-mainnet.md](before-mainnet.md).

---

## Application checklist (when we're ready to submit)

- [ ] Tier A complete
- [ ] At least 3 Tier B items shipped (B1, B4, B6 minimum)
- [ ] $PRISM token mainnet contract + Bags page link
- [ ] Verified team page on the marketing site
- [ ] Public Dune dashboard URL
- [ ] GitHub stars > 50 (push to social)
- [ ] At least 3 real loan transactions with public tx hashes
- [ ] Demo video showing the full creator-credit loop (collateral pledge → loan → fee accrual → repayment)
- [ ] Application narrative emphasising **fee-sharing securitisation** as the differentiator
- [ ] Categories selected: DeFi, Fee Sharing, Bags API, Privacy, Social Finance
- [ ] Refer link generated (we get a share of pool from referrals, per the rules)

---

## Cross-references

| Topic | Where to look |
|---|---|
| Original Frontier side-track strategy (Encrypt+Ika, Cloak, Dune SIM) | [01-sidetrack-strategy.md](01-sidetrack-strategy.md) |
| Locked architecture & demo numbers | [12-reference-card.md](12-reference-card.md) |
| Full system spec | [protocol_explained.md](protocol_explained.md) |
| Production-readiness checklist | [before-mainnet.md](before-mainnet.md) |
| IKA collateral flow (Privacy track) | [ika-integration.md](ika-integration.md), [ika-audit-2026-05-01.md](ika-audit-2026-05-01.md) |
| Bags docs (external) | https://docs.bags.fm |
| Hackathon page (external) | https://bags.fm/hackathon |
