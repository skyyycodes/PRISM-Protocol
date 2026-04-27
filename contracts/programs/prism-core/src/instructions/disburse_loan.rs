use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::{GlobalConfig, Vault, Loan, LoanState};

#[derive(Accounts)]
pub struct DisburseLoan<'info> {
    pub admin: Signer<'info>,

    #[account(seeds = [b"config"], bump, has_one = admin)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut, seeds = [b"vault", &vault.id.to_le_bytes()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(mut, has_one = vault, constraint = loan.state == LoanState::Originated)]
    pub loan: Account<'info, Loan>,

    #[account(mut, seeds = [b"reserve", vault.key().as_ref()], bump)]
    pub vault_usdc_reserve: Account<'info, TokenAccount>,

    #[account(mut, token::mint = config.usdc_mint, token::authority = loan.borrower)]
    pub borrower_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(_ctx: Context<DisburseLoan>) -> Result<()> {
    // MVP note: not called in the closed-loop demo. Loan stays at Originated.
    // see 09-lld-completion.md §9.4 disburse_loan pseudocode
    // Day 1: stub — implement if needed
    Ok(())
}
