use anchor_lang::prelude::*;

#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub vault: Pubkey,
    pub tranche_kind: u8,
    pub usdc_amount: u64,
    pub shares_minted: u64,
    pub nav_at_deposit_q: u128,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawEvent {
    pub user: Pubkey,
    pub vault: Pubkey,
    pub tranche_kind: u8,
    pub shares_burned: u64,
    pub usdc_paid: u64,
    pub nav_at_withdraw_q: u128,
    pub timestamp: i64,
}

#[event]
pub struct YieldDistributed {
    pub vault: Pubkey,
    pub total_yield: u64,
    pub prime_take: u64,
    pub core_take: u64,
    pub alpha_take: u64,
    pub timestamp: i64,
}

#[event]
pub struct LossApplied {
    pub vault: Pubkey,
    pub credit_event_seq: u32,
    pub tranche_kind: u8,
    pub loss_amount: u64,
    pub new_total_assets: u64,
    pub new_nav_q: u128,
    pub timestamp: i64,
}

#[event]
pub struct BagsCollateralActivated {
    pub loan: Pubkey,
    pub vault: Pubkey,
    pub creator_wallet: Pubkey,
    pub bags_token_mint: Pubkey,
    pub fee_claimer_pda: Pubkey,
    pub share_bps: u16,
    pub valuation_usd_micro: u64,
    pub trailing_30d_sol_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct BagsFeesSwept {
    pub loan: Pubkey,
    pub vault: Pubkey,
    pub bags_token_mint: Pubkey,
    pub sweep_seq: u32,
    pub sol_lamports_claimed: u64,
    pub usdc_applied: u64,
    pub cumulative_swept_lamports: u64,
    pub cumulative_swept_usdc: u64,
    pub timestamp: i64,
}

#[event]
pub struct CreditEventCreated {
    pub vault: Pubkey,
    pub seq: u32,
    pub event_type: u8,
    pub loss_amount: u64,
    pub severity_bps: u16,
    pub triggered_by: Pubkey,
    pub timestamp: i64,
}
