---
sidebar_position: 16
title: Glossary
id: glossary
---

# Glossary

## AMM

Automated market maker. PRISM uses constant-product AMMs to trade tranche tokens against USDC.

## Constant-Product

The AMM pricing rule `x * y = k`, where `x` and `y` are reserves of the two tokens in a pool and `k` is a constant. Each trade keeps the product unchanged and shifts price along the curve.

## Credit Event

An event that reduces vault assets and triggers the loss cascade. Examples include borrower default, partial loss, and recovery.

## Default Cascade

The reverse-priority loss application that absorbs realized losses Equity → Mezzanine → Senior. Senior protection emerges from this ordering, not from any external guarantee.

## Equity Tranche

The highest-risk tranche. Equity receives residual upside but absorbs losses first.

## Fixed-Point (Q64.64)

Rational-number representation used for NAV math. Q64.64 stores values as 128-bit integers where the high 64 bits are the integer part and the low 64 bits are the fractional part. Avoids floating-point drift and gives deterministic on-chain accounting.

## Liquidity Provider (LP)

An account that deposits both sides of an AMM pool (a tranche token and USDC) and receives LP tokens representing a proportional share of pool reserves and accumulated fees.

## Loss Bucket

A program-controlled token account that holds USDC moved out of the vault reserve when a credit event is realized. Maintains the reserve invariant by absorbing the cash that corresponds to the realized loss.

## Mezzanine Tranche

The intermediate tranche. Mezzanine is paid after Senior and absorbs losses after Equity.

## NAV

Net asset value per share.

```text
NAV = total_assets / total_supply
```

## PDA

Program-derived address. A deterministic account address generated from program-defined seeds and signed only by the owning program. PRISM uses PDAs to hold authority over vault reserves, tranche mints, AMM pools, and LP mints.

## pEQUITY

SPL token representing a claim on the Equity tranche.

## pMEZZ

SPL token representing a claim on the Mezzanine tranche.

## pSENIOR

SPL token representing a claim on the Senior tranche.

## PRISM

**P**rogrammable **R**isk and **I**ncome **S**tructured **M**arkets. The protocol decomposes a credit pool into tranches the same way a prism separates light into bands.

## Reserve (Vault Reserve)

The USDC token account held by a vault. Stores all deposited USDC and source funds for withdrawals.

## Reserve Invariant

The accounting rule that the vault USDC reserve must equal the sum of tranche assets at all times.

```text
reserve = senior_assets + mezzanine_assets + equity_assets
```

Maintained by transferring loss USDC to the loss bucket whenever a credit event reduces tranche assets.

## Senior Tranche

The most protected tranche. Senior is paid first and absorbs losses last.

## Strategy Preset

An interface-level allocation template (Conservative, Balanced, Aggressive) that splits a single deposit across the three tranches according to a fixed risk profile. Presets are user-experience tools, not protocol primitives.

## Subordination

The hierarchy that determines which tranche absorbs losses first. Equity is most subordinated, Senior is least.

## Tranche

A risk-segmented slice of a credit vault. Each tranche has its own NAV, target yield, loss position, and SPL token.

## Vault

A single PRISM credit pool. Contains a USDC reserve, three tranches, optional loan references, and a credit-event log. Vault state machine: `Active`, `Defaulted`, `Resolved`.

## Waterfall

The deterministic payment order used to distribute incoming yield. Senior receives target yield first, then Mezzanine, then Equity receives the residual.

