use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::AmmPool;
use crate::errors::AmmError;

#[derive(Accounts)]
#[instruction(fee_bps: u16)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub tranche_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = admin,
        space = 8 + AmmPool::INIT_SPACE,
        seeds = [b"amm", tranche_mint.key().as_ref()],
        bump,
    )]
    pub pool: Box<Account<'info, AmmPool>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePoolReserves<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, seeds = [b"amm", pool.tranche_mint.as_ref()], bump = pool.bump)]
    pub pool: Box<Account<'info, AmmPool>>,

    pub tranche_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = admin,
        seeds = [b"amm_tranche", tranche_mint.key().as_ref()],
        bump,
        token::mint = tranche_mint,
        token::authority = pool,
    )]
    pub tranche_reserve: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = admin,
        seeds = [b"amm_quote", tranche_mint.key().as_ref()],
        bump,
        token::mint = quote_mint,
        token::authority = pool,
    )]
    pub quote_reserve: Box<Account<'info, TokenAccount>>,

    /// LP mint, authority = pool PDA
    #[account(
        init,
        payer = admin,
        seeds = [b"amm_lp", tranche_mint.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = pool,
    )]
    pub lp_mint: Box<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializePool>, fee_bps: u16) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.tranche_mint = ctx.accounts.tranche_mint.key();
    pool.quote_mint = ctx.accounts.quote_mint.key();
    pool.fee_bps = fee_bps;
    pool.bump = ctx.bumps.pool;
    Ok(())
}

pub fn reserves_handler(ctx: Context<InitializePoolReserves>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.tranche_reserve = ctx.accounts.tranche_reserve.key();
    pool.quote_reserve = ctx.accounts.quote_reserve.key();
    pool.lp_mint = ctx.accounts.lp_mint.key();
    Ok(())
}
