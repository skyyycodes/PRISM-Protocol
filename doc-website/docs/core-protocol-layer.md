---
sidebar_position: 4
title: Core Protocol Layer
id: core-protocol-layer
---

# Core Protocol Layer

The Core Protocol Layer is the deterministic execution engine of PRISM. It owns the vault accounting model, tranche state, NAV calculation, yield waterfall, and default resolution.

## Vault

A vault represents a single credit pool containing multiple risk tranches.

Each vault tracks:

- USDC reserve.
- Tranche configuration.
- Total assets across tranches.
- Credit event history.
- Permission and pause state.

A vault is not a generic pool. It is a structured credit container with explicit rules for who gets paid first and who absorbs losses first.

## Tranches

Each vault is partitioned into three tranches:

| Tranche | Description | Waterfall Position | Loss Position |
| --- | --- | --- | --- |
| Senior | Loss-protected exposure (junior tranches absorb first) | Paid first | Absorbs last |
| Mezzanine | Intermediate risk exposure | Paid second | Absorbs second |
| Equity | Residual upside exposure (first-loss capital) | Paid last | Absorbs first |

Each tranche maintains:

- `total_assets`
- `total_supply`
- NAV per share
- target yield parameters, where applicable
- token mint relationship

## NAV Per Share

NAV is the intrinsic accounting value of one tranche token.

```text
NAV = total_assets / total_supply
```

Deposits mint shares based on current NAV. Withdrawals burn shares and redeem USDC based on current NAV. Yield increases tranche assets. Loss decreases tranche assets.

## Waterfall Distribution

Incoming yield is allocated in priority order:

1. Senior tranche.
2. Mezzanine tranche.
3. Equity tranche.

Senior and Mezzanine target rates define how much yield those tranches are entitled to before residual yield reaches Equity. Equity receives the remaining upside after higher-priority claims are satisfied.

## Default Resolution

Losses are applied in reverse priority:

1. Equity absorbs losses first.
2. Mezzanine absorbs residual losses.
3. Senior absorbs losses only after subordinate tranches are depleted.

This makes subordination explicit. Senior protection is not magic; it exists because junior capital is placed below Senior in the loss stack.

## Reserve Invariant

The core accounting invariant is:

```text
vault_usdc_reserve = senior_assets + mezzanine_assets + equity_assets
```

When yield enters, both the reserve and tranche assets increase. When a loss is realized, USDC leaves the vault and tranche assets decrease through the cascade.

