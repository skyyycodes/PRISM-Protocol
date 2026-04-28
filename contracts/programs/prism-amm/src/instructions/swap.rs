use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Swap {
    // Full context: see 09-lld-completion.md §9.4 swap pseudocode
    // Day 1: stub context — implement Day 6
}

pub fn handler(
    _ctx: Context<Swap>,
    _amount_in: u64,
    _min_amount_out: u64,
    _direction: u8,
) -> Result<()> {
    // see 09-lld-completion.md §9.4 swap handler pseudocode
    // Day 1: stub — implement Day 6
    Ok(())
}
