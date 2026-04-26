---
sidebar_position: 16
title: Glossary
id: glossary
---

# Glossary

## AMM

Automated market maker. PRISM uses constant-product AMMs to trade tranche tokens against USDC.

## Credit Event

An event that reduces vault assets and triggers the loss cascade.

## Equity Tranche

The highest-risk tranche. Equity receives residual upside but absorbs losses first.

## Mezzanine Tranche

The intermediate tranche. Mezzanine is paid after Senior and absorbs losses after Equity.

## NAV

Net asset value per share.

```text
NAV = total_assets / total_supply
```

## pEQUITY

SPL token representing a claim on the Equity tranche.

## pMEZZ

SPL token representing a claim on the Mezzanine tranche.

## pSENIOR

SPL token representing a claim on the Senior tranche.

## Senior Tranche

The most protected tranche. Senior is paid first and absorbs losses last.

## Subordination

The hierarchy that determines which tranche absorbs losses first.

## Tranche

A risk-segmented slice of a credit vault.

## Waterfall

The deterministic payment order used to distribute incoming yield.

