use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AccrueYield<'info> {
    // Full context: see 09-lld-completion.md §9.4 accrue_yield pseudocode
    // Day 1: stub context — implement Day 3
}

pub fn handler(_ctx: Context<AccrueYield>, _yield_amount: u64) -> Result<()> {
    // see 09-lld-completion.md §9.4 accrue_yield handler pseudocode
    // Day 1: stub — implement Day 3
    Ok(())
}
