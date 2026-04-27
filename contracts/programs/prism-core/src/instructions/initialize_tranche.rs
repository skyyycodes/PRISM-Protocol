use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use crate::state::{GlobalConfig, Vault, Tranche};

#[derive(Accounts)]
#[instruction(kind: u8, target_apy_bps: u16)]
pub struct InitializeTranche<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(seeds = [b"config"], bump, has_one = admin)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut, seeds = [b"vault", &vault.id.to_le_bytes()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = admin,
        space = 8 + Tranche::INIT_SPACE,
        seeds = [b"tranche", vault.key().as_ref(), &[kind]],
        bump,
    )]
    pub tranche: Account<'info, Tranche>,

    /// SPL mint for pTRANCHE token. Mint authority = tranche PDA.
    #[account(
        init,
        payer = admin,
        seeds = [b"mint", vault.key().as_ref(), &[kind]],
        bump,
        mint::decimals = 6,
        mint::authority = tranche,
    )]
    pub tranche_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    _ctx: Context<InitializeTranche>,
    _kind: u8,
    _target_apy_bps: u16,
) -> Result<()> {
    // see 09-lld-completion.md §9.4 initialize_tranche pseudocode
    // Day 1: stub — implement Day 2
    Ok(())
}
