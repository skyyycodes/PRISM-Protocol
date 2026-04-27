use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::AmmPool;
use crate::errors::AmmError;

#[derive(Accounts)]
#[instruction(fee_bps: u16)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub tranche_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + AmmPool::INIT_SPACE,
        seeds = [b"amm", tranche_mint.key().as_ref()],
        bump,
    )]
    pub pool: Account<'info, AmmPool>,

    #[account(
        init,
        payer = admin,
        seeds = [b"amm_tranche", tranche_mint.key().as_ref()],
        bump,
        token::mint = tranche_mint,
        token::authority = pool,
    )]
    pub tranche_reserve: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = admin,
        seeds = [b"amm_quote", tranche_mint.key().as_ref()],
        bump,
        token::mint = quote_mint,
        token::authority = pool,
    )]
    pub quote_reserve: Account<'info, TokenAccount>,

    /// LP mint, authority = pool PDA
    #[account(
        init,
        payer = admin,
        seeds = [b"amm_lp", tranche_mint.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = pool,
    )]
    pub lp_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(_ctx: Context<InitializePool>, _fee_bps: u16) -> Result<()> {
    // see 09-lld-completion.md §9.4 initialize_pool pseudocode
    // Day 1: stub — implement Day 6
    Ok(())
}
