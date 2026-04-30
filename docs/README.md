# PRISM Protocol — Documentation Index (start here)

**You are a coding agent reading this project for the first time.** Read this file in full before opening any other doc. It tells you what to read, in what order, and what each doc is for.

---


## What this project is (1 minute)

**PRISM Protocol** is a Solana-based on-chain credit market submitted to the **Solana Frontier Hackathon** (Colosseum). Deadline: **May 11, 2026**.

A user deposits USDC into one of three risk tranches (`Prime` / `Core` / `Alpha`). A simulated borrower pays yield, which gets distributed via a waterfall (Prime first, then Core, then Alpha). When a credit event triggers, losses cascade in reverse priority (Alpha wiped first, then Core, then Prime). Tranche tokens (`pPRIME`, `pCORE`, `pALPHA`) trade on a constant-product AMM — letting markets price credit risk live.

**Pitch line:** *"PRISM Protocol turns credit into programmable, tradable risk layers — with live loss simulation and real-time market pricing."*

**Stack:** Anchor (Rust) + Solana devnet + Next.js + Tailwind + Solana Wallet Adapter + Framer Motion. Two programs: `prism_core` (credit engine) and `prism_amm` (market layer).

---

## Reading order (mandatory)

Read these in order. Don't skip.

| Step | Doc | Purpose | Time |
|---|---|---|---|
| 1 | **This file** ([README.md](README.md)) | Orientation | 5 min |
| 2 | **[CLAUDE.md](CLAUDE.md)** | Coding conventions, do's/don'ts, anti-patterns. Apply to every file you write | 10 min |
| 3 | **[00-overview.md](00-overview.md)** | Master index + 13 locked architecture decisions | 10 min |
| 4 | **[12-reference-card.md](12-reference-card.md)** | Single-page lookup for all magic numbers, PDA seeds, error codes, events, demo wallets. **Keep this open while coding.** | 5 min |
| 5 | **[06-mvp-build-plan.md](06-mvp-build-plan.md)** | Day-by-day plan + Tier 1/2/3 priorities + Day 5 checkpoint rule | 15 min |
| 6 | **[10-scaffolding-day-1.md](10-scaffolding-day-1.md)** | Exact files to create on Day 1 with content | 20 min |

After step 6, you have enough context to start coding. The remaining docs are reference material — read on-demand when the task calls for them.

---

## Reference docs (read when relevant)

| Doc | Read when |
|---|---|
| [01-sidetrack-strategy.md](01-sidetrack-strategy.md) | Preparing submissions for side tracks |
| [02-domain-model.md](02-domain-model.md) | Writing account structs / PDA logic |
| [03-layered-architecture.md](03-layered-architecture.md) | Building the pitch deck or explaining the system |
| [04-data-flows.md](04-data-flows.md) | Implementing user flows + recording the demo video |
| [05-anchor-architecture.md](05-anchor-architecture.md) | Writing instruction handlers — see hot-path Anchor contexts here |
| [07-roadmap.md](07-roadmap.md) | Building the pitch deck closer slide |
| [08-open-questions.md](08-open-questions.md) | Want to know "why did we pick X?" — every architectural decision is logged with rationale |
| [09-lld-completion.md](09-lld-completion.md) | The LLD bible. Full Anchor contexts for ALL 15 instructions, handler pseudocode, helpers, tests, frontend tree, partner SDK patterns |
| [11-setup-demo-script.md](11-setup-demo-script.md) | Writing `scripts/setup-demo.ts` |
| [13-demo-runbook.md](13-demo-runbook.md) | Day 15 recording session |

---

## Hard rules — never break these

These show up multiple times across the docs. They're called out here to prevent slip-ups:

1. **Tier 1 must work perfectly before any Tier 2 or 3 work.** Tier 1 = `deposit`, `accrue_yield` (waterfall), `trigger_credit_event` (cascade). If these don't work, the demo fails. See [06-mvp-build-plan.md §6.2](06-mvp-build-plan.md).

2. **Day 5 is a hard checkpoint.** By end of Day 5, Tier 1 must work in CLI/script form — even with no UI. This is the safety net for video recording. See [06-mvp-build-plan.md §6.4 Phase 1](06-mvp-build-plan.md).

3. **IDL sync after every contract change.** Run `anchor build && anchor idl parse` and commit the IDL. Frontend type drift is the #1 wasted-time bug.

4. **Demo recording deadline: Day 15, not Day 16.** Day 16 is for submitting only.

5. **Never drop a higher tier for a lower one.** Strategy presets never come before NAV math working.

6. **The vault USDC reserve invariant: `vault_usdc_reserve.amount == sum(tranche.total_assets)` at all times.** On default, transfer `loss_amount` USDC to `loss_bucket` PDA. If you skip this, accounting and cash drift apart.

7. **NAV edge cases — three explicit handlers in `deposit`:**
   - If `total_supply == 0` → mint shares 1:1 (NAV starts at 1.0)
   - If wiped (NAV → 0 with supply > 0) → block deposits with `TrancheWipedNoDepositsAllowed`
   - Total wipeout (Alpha NAV = 0) on withdraw → returns 0 USDC. **This is the demo moment, not a bug.**

---

## What's locked vs what's flexible

Almost everything is **locked**. The 13 architecture decisions in [00-overview.md](00-overview.md) and the 4 Tier 1 decisions + 2 Tier 1B decisions in [08-open-questions.md](08-open-questions.md) are settled — don't relitigate.

What you CAN change without asking:
- Implementation details that aren't called out in the locked decisions (e.g., specific helper function names, internal variable naming)
- Test scaffolding patterns
- CSS / styling beyond the storyboard requirements
- Helper utility functions and modules

What you must NOT change without asking:
- Any of the 13 architecture decisions
- Demo numbers (every USDC is accounted for — see [12-reference-card.md](12-reference-card.md))
- Tier priorities (see [06-mvp-build-plan.md §6.2](06-mvp-build-plan.md))
- Token strategy (tokenless through Phase 2)
- The 5 hero features list
- Demo arc structure

---

## When in doubt

- "What does X mean?" → [12-reference-card.md](12-reference-card.md) (glossary at the end)
- "What's the value of constant Y?" → [12-reference-card.md](12-reference-card.md)
- "How is Z derived as a PDA?" → [12-reference-card.md](12-reference-card.md)
- "Why did we pick decision W?" → [08-open-questions.md](08-open-questions.md)
- "What instruction context does the handler need?" → [09-lld-completion.md §9.3](09-lld-completion.md) (or [05-anchor-architecture.md §5.4](05-anchor-architecture.md) for hot-path)
- "What does this user flow look like end-to-end?" → [04-data-flows.md](04-data-flows.md)
- "What's the Day-N task?" → [06-mvp-build-plan.md §6.4](06-mvp-build-plan.md)

---

## Done reading? Next steps

If you've read steps 1–6 above, you have enough context to:
- Scaffold the project (Day 1) — see [10-scaffolding-day-1.md](10-scaffolding-day-1.md)
- Begin writing Anchor contracts (Day 2+) — see [05-anchor-architecture.md](05-anchor-architecture.md) and [09-lld-completion.md](09-lld-completion.md)

If you have specific questions, check [12-reference-card.md](12-reference-card.md) and [08-open-questions.md](08-open-questions.md) first. Most have answers.
