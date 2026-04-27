use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use crate::state::{GlobalConfig, Vault, Loan};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct RepayLoan<'info> {
    pub borrower: Signer<'info>,

    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut, seeds = [b"vault", &vault.id.to_le_bytes()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(mut, has_one = vault, constraint = loan.borrower == borrower.key())]
    pub loan: Account<'info, Loan>,

    #[account(mut, token::mint = config.usdc_mint, token::authority = borrower)]
    pub borrower_usdc_ata: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"reserve", vault.key().as_ref()], bump)]
    pub vault_usdc_reserve: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(_ctx: Context<RepayLoan>, _amount: u64) -> Result<()> {
    // see 09-lld-completion.md §9.4 repay_loan handler pseudocode
    // Day 1: stub — implement Day 3
    Ok(())
}
