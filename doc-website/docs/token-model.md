---
sidebar_position: 11
title: Token Model
id: token-model
---

# Token Model

Each PRISM tranche is represented by a fungible SPL token.

## Tranche Tokens

| Token | Tranche | Meaning |
| --- | --- | --- |
| `pPRIME` | Prime | Claim on Prime tranche NAV |
| `pCORE` | Core | Claim on Core tranche NAV |
| `pALPHA` | Alpha | Claim on Alpha tranche NAV |

## Lifecycle

Tranche tokens are:

- Minted on deposit.
- Held in user token accounts.
- Traded on AMMs.
- Burned on withdrawal.

They are not receipt NFTs. They are fungible claims on a tranche's current accounting value.

## Transferability

Because tranche positions are tokenized, users can move exposure without closing the vault position directly.

Transferability enables:

- Secondary market liquidity.
- Portfolio construction.
- Strategy vaults.
- Integrations with external analytics and risk interfaces.

## Redemption

Redemption value is based on current NAV, not original deposit amount.

```text
redemption_value = token_amount * tranche_NAV
```

If a user buys pCORE on the AMM at a discount to NAV, the vault still uses NAV for withdrawal. If a user buys above NAV, the vault still uses NAV. The protocol does not remember trade price.

