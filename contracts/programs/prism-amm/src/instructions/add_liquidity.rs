use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::AmmPool;

#[derive(Accounts)]
#[instruction(tranche_amount: u64, quote_amount: u64, min_lp_out: u64)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub lp: Signer<'info>, // admin in MVP

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

    #[account(
        init_if_needed,
        payer = lp,
        associated_token::mint = lp_mint,
        associated_token::authority = lp,
    )]
    pub lp_lp_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    _ctx: Context<AddLiquidity>,
    _tranche_amount: u64,
    _quote_amount: u64,
    _min_lp_out: u64,
) -> Result<()> {
    // see 09-lld-completion.md §9.4 add_liquidity pseudocode
    // Day 1: stub — implement Day 6
    Ok(())
}
