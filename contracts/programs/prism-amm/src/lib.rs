use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");
// Replace after first `anchor build` with the actual program ID from
// target/deploy/prism_amm-keypair.json (run `solana address -k <path>`)

pub mod errors;
pub mod state;
pub mod events;
pub mod pda;
pub mod instructions;

use instructions::*;

#[program]
pub mod prism_amm {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, fee_bps: u16) -> Result<()> {
        instructions::initialize_pool::handler(ctx, fee_bps)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        tranche_amount: u64,
        quote_amount: u64,
        min_lp_out: u64,
    ) -> Result<()> {
        instructions::add_liquidity::handler(ctx, tranche_amount, quote_amount, min_lp_out)
    }

    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_amount: u64,
        min_tranche_out: u64,
        min_quote_out: u64,
    ) -> Result<()> {
        instructions::remove_liquidity::handler(ctx, lp_amount, min_tranche_out, min_quote_out)
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        min_amount_out: u64,
        direction: u8,
    ) -> Result<()> {
        instructions::swap::handler(ctx, amount_in, min_amount_out, direction)
    }
}
