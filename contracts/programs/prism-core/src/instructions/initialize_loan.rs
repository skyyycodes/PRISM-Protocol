use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, Vault, Loan};

#[derive(Accounts)]
#[instruction(loan_id: u32, principal: u64, apr_bps: u16, maturity_ts: i64, borrower: Pubkey)]
pub struct InitializeLoan<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(seeds = [b"config"], bump, has_one = admin)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut, seeds = [b"vault", &vault.id.to_le_bytes()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = admin,
        space = 8 + Loan::INIT_SPACE,
        seeds = [b"loan", vault.key().as_ref(), &loan_id.to_le_bytes()],
        bump,
    )]
    pub loan: Account<'info, Loan>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    _ctx: Context<InitializeLoan>,
    _loan_id: u32,
    _principal: u64,
    _apr_bps: u16,
    _maturity_ts: i64,
    _borrower: Pubkey,
) -> Result<()> {
    // see 09-lld-completion.md §9.4 initialize_loan pseudocode
    // Day 1: stub — implement Day 2
    Ok(())
}
