---
sidebar_position: 9
title: Core Operations
id: core-operations
---

# Core Operations

PRISM exposes five core operations: deposit, yield accrual, credit event resolution, withdrawal, and trading.

## Deposit

Users deposit USDC into a selected tranche and receive tranche tokens proportional to NAV.

Deposit flow:

1. User selects Senior, Mezzanine, or Equity.
2. User transfers USDC into the vault reserve.
3. Protocol calculates shares using current NAV.
4. Protocol mints tranche tokens to the user.
5. Tranche assets and supply update.

For the first deposit into a tranche, shares are minted 1:1 with deposited USDC.

## Yield Accrual

Authorized accounts transfer USDC into the vault, triggering distribution across tranches.

Yield flow:

1. Authorized yield source calls the accrual instruction.
2. USDC enters the vault reserve.
3. Protocol computes each tranche's waterfall entitlement.
4. Senior receives target yield first.
5. Mezzanine receives target yield second.
6. Equity receives residual yield.
7. NAV updates for every affected tranche.

## Credit Events

A credit event reduces total assets in the system according to predefined loss parameters.

Credit event flow:

1. Oracle or authorized admin submits a loss amount.
2. Protocol records the credit event.
3. Loss is applied to Equity first.
4. Residual loss is applied to Mezzanine.
5. Any remaining loss is applied to Senior.
6. USDC moves from vault reserve to the loss sink.
7. NAV updates to reflect the realized loss.

## Withdrawal

Users burn tranche tokens and receive USDC based on current NAV.

Withdrawal flow:

1. User selects a tranche token amount.
2. Protocol computes redemption value from NAV.
3. Tranche tokens are burned.
4. USDC transfers from reserve to the user.
5. Tranche assets and supply decrease.

If NAV has fallen due to losses, withdrawal value falls with it.

## Trading

Users may trade tranche tokens on AMM pools.

Trading flow:

1. User selects a market, such as `pMEZZ / USDC`.
2. AMM calculates output using constant-product pricing.
3. User receives output asset.
4. Pool reserves update.
5. Market price changes.

Trading provides an exit or repositioning path without interacting with the vault directly.

