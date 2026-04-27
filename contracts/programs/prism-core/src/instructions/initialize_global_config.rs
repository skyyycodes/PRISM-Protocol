use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct InitializeGlobalConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, GlobalConfig>,

    pub usdc_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    _ctx: Context<InitializeGlobalConfig>,
    _default_yield_rate_bps: u16,
    _oracle_allowlist: Vec<Pubkey>,
) -> Result<()> {
    // see 09-lld-completion.md §9.4 initialize_global_config pseudocode
    // Day 1: stub — implement Day 2
    Ok(())
}
