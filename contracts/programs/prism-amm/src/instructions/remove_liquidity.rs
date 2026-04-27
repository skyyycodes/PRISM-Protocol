use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::AmmPool;

#[derive(Accounts)]
#[instruction(lp_amount: u64, min_tranche_out: u64, min_quote_out: u64)]
pub struct RemoveLiquidity<'info> {
    pub lp: Signer<'info>,

    #[account(
        mut,
        seeds = [b"amm", pool.tranche_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, AmmPool>,

    #[account(mut, constraint = tranche_reserve.key() == pool.tranche_reserve)]
    pub tranche_reserve: Account<'info, TokenAccount>,
    #[account(mut, constraint = quote_reserve.key() == pool.quote_reserve)]
    pub quote_reserve: Account<'info, TokenAccount>,

    #[account(mut, constraint = lp_mint.key() == pool.lp_mint)]
    pub lp_mint: Account<'info, Mint>,

    #[account(mut, token::mint = pool.tranche_mint, token::authority = lp)]
    pub lp_tranche_ata: Account<'info, TokenAccount>,
    #[account(mut, token::mint = pool.quote_mint, token::authority = lp)]
    pub lp_quote_ata: Account<'info, TokenAccount>,

    #[account(mut, token::mint = lp_mint, token::authority = lp)]
    pub lp_lp_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    _ctx: Context<RemoveLiquidity>,
    _lp_amount: u64,
    _min_tranche_out: u64,
    _min_quote_out: u64,
) -> Result<()> {
    // see 09-lld-completion.md §9.4 remove_liquidity pseudocode
    // Day 1: stub — implement Day 6
    Ok(())
}
