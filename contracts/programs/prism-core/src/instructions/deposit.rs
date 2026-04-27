use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::*;
use crate::errors::PrismError;

#[derive(Accounts)]
#[instruction(tranche_kind: u8, usdc_amount: u64)]
pub struct Deposit<'info> {
    // Full context: see 09-lld-completion.md §9.3 (hot-path) and §9.4 deposit pseudocode
    // Day 1: stub context — implement Day 3
}

pub fn handler(
    _ctx: Context<Deposit>,
    _tranche_kind: u8,
    _usdc_amount: u64,
) -> Result<()> {
    // see 09-lld-completion.md §9.4 deposit handler pseudocode
    // Day 1: stub — implement Day 3
    Ok(())
}
