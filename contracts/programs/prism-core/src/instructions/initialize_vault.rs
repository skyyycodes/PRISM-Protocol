use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::{GlobalConfig, Vault};
use crate::errors::PrismError;

#[derive(Accounts)]
#[instruction(vault_id: u32)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(seeds = [b"config"], bump, has_one = admin @ PrismError::Unauthorized)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = admin,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", &vault_id.to_le_bytes()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(constraint = usdc_mint.key() == config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,

    /// Vault USDC reserve token account, authority = vault PDA
    #[account(
        init,
        payer = admin,
        seeds = [b"reserve", vault.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = vault,
    )]
    pub vault_usdc_reserve: Account<'info, TokenAccount>,

    /// Loss bucket token account, authority = vault PDA
    #[account(
        init,
        payer = admin,
        seeds = [b"loss_bucket", vault.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = vault,
    )]
    pub loss_bucket: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(_ctx: Context<InitializeVault>, _vault_id: u32) -> Result<()> {
    // see 09-lld-completion.md §9.4 initialize_vault pseudocode
    // Day 1: stub — implement Day 2
    Ok(())
}
