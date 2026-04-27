use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub default_yield_rate_bps: u16,
    pub paused: bool,
    #[max_len(8)]
    pub oracle_allowlist: Vec<Pubkey>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub id: u32,
    pub usdc_mint: Pubkey,
    pub usdc_reserve: Pubkey,
    pub tranche_pdas: [Pubkey; 3],
    pub loan_pda: Pubkey,
    pub state: VaultState,
    pub total_deposits: u64,
    pub total_loaned: u64,
    pub last_yield_timestamp: i64,
    pub credit_event_seq: u32,    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VaultState {
    Active,
    Defaulted,
    Resolved,
}

#[account]
#[derive(InitSpace)]
pub struct Tranche {
    pub vault: Pubkey,
    pub kind: TrancheKind,
    pub mint: Pubkey,
    pub target_apy_bps: u16,
    pub total_assets: u64,
    pub total_supply: u64,
    pub nav_per_share_q: u128,
    pub cumulative_yield: u64,
    pub cumulative_loss: u64,
    pub last_nav_update_ts: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TrancheKind {
    Senior,
    Mezz,
    Equity,
}

#[account]
#[derive(InitSpace)]
pub struct Loan {
    pub id: u32,
    pub vault: Pubkey,
    pub borrower: Pubkey,
    pub principal: u64,
    pub apr_bps: u16,
    pub origination_ts: i64,
    pub maturity_ts: i64,
    pub state: LoanState,
    pub total_repaid: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum LoanState {
    Originated,
    Active,
    Repaying,
    Defaulted,
    Resolved,
}

#[account]
#[derive(InitSpace)]
pub struct CreditEvent {
    pub vault: Pubkey,
    pub seq: u32,
    pub event_type: CreditEventType,
    pub loan: Pubkey,
    pub loss_amount: u64,
    pub recovery_amount: u64,
    pub severity_bps: u16,
    pub timestamp: i64,
    pub triggered_by: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CreditEventType {
    Default,
    PartialLoss,
    Recovery,
}
