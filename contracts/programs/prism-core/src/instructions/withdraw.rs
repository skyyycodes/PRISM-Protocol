use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::{GlobalConfig, Vault, Tranche};
use crate::errors::PrismError;

#[derive(Accounts)]
#[instruction(tranche_kind: u8, share_amount: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"config"], bump, constraint = !config.paused @ PrismError::VaultPaused)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut, seeds = [b"vault", &vault.id.to_le_bytes()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"tranche", vault.key().as_ref(), &[tranche_kind]],
        bump = tranche.bump,
    )]
    pub tranche: Account<'info, Tranche>,

    #[account(
        mut,
        seeds = [b"mint", vault.key().as_ref(), &[tranche_kind]],
        bump,
    )]
    pub tranche_mint: Account<'info, Mint>,

    #[account(mut, seeds = [b"reserve", vault.key().as_ref()], bump)]
    pub vault_usdc_reserve: Account<'info, TokenAccount>,

    #[account(mut, token::mint = tranche_mint, token::authority = user)]
    pub user_tranche_ata: Account<'info, TokenAccount>,

    #[account(mut, token::mint = config.usdc_mint, token::authority = user)]
    pub user_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    _ctx: Context<Withdraw>,
    _tranche_kind: u8,
    _share_amount: u64,
) -> Result<()> {
    // see 09-lld-completion.md §9.4 withdraw handler pseudocode
    // Day 1: stub — implement Day 3
    Ok(())
}
