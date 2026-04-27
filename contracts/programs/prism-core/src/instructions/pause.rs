use anchor_lang::prelude::*;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct Pause<'info> {
    pub admin: Signer<'info>,

    #[account(mut, seeds = [b"config"], bump, has_one = admin)]
    pub config: Account<'info, GlobalConfig>,
}

pub fn pause_handler(_ctx: Context<Pause>) -> Result<()> {
    // see 09-lld-completion.md §9.4 pause pseudocode
    // Day 1: stub — implement Day 2
    Ok(())
}

pub fn unpause_handler(_ctx: Context<Pause>) -> Result<()> {
    // see 09-lld-completion.md §9.4 unpause pseudocode
    // Day 1: stub — implement Day 2
    Ok(())
}
