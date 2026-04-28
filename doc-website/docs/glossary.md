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

## Alpha Tranche

The highest-risk tranche. Alpha receives residual upside but absorbs losses first.

## Core Tranche

The intermediate tranche. Core is paid after Prime and absorbs losses after Alpha.

## NAV

Net asset value per share.

```text
NAV = total_assets / total_supply
```

## pALPHA

SPL token representing a claim on the Alpha tranche.

## pCORE

SPL token representing a claim on the Core tranche.

## pPRIME

SPL token representing a claim on the Prime tranche.

## Prime Tranche

The most protected tranche. Prime is paid first and absorbs losses last.

## Subordination

The hierarchy that determines which tranche absorbs losses first.

## Tranche

A risk-segmented slice of a credit vault.

## Waterfall

The deterministic payment order used to distribute incoming yield.

