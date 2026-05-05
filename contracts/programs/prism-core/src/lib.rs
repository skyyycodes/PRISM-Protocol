use anchor_lang::prelude::*;

declare_id!("3A4Cjb4YQw2vqhUj4PkVAKu11MbemnUfSaFXHxwcdV9F");

pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod pda;
pub mod state;

use instructions::*;

#[program]
pub mod prism_core {
    use super::*;

    pub fn initialize_global_config(
        ctx: Context<InitializeGlobalConfig>,
        default_yield_rate_bps: u16,
        oracle_allowlist: Vec<Pubkey>,
    ) -> Result<()> {
        instructions::initialize_global_config_handler(
            ctx,
            default_yield_rate_bps,
            oracle_allowlist,
        )
    }

    pub fn initialize_vault(ctx: Context<InitializeVault>, vault_id: u32) -> Result<()> {
        instructions::initialize_vault_handler(ctx, vault_id)
    }

    pub fn initialize_vault_reserves(ctx: Context<InitializeVaultReserves>) -> Result<()> {
        instructions::initialize_vault::reserves_handler(ctx)
    }

    pub fn initialize_vault_loss_bucket(ctx: Context<InitializeVaultLossBucket>) -> Result<()> {
        instructions::initialize_vault::loss_bucket_handler(ctx)
    }

    pub fn initialize_tranche(
        ctx: Context<InitializeTranche>,
        kind: u8,
        target_apy_bps: u16,
    ) -> Result<()> {
        instructions::initialize_tranche_handler(ctx, kind, target_apy_bps)
    }

    pub fn initialize_loan(
        ctx: Context<InitializeLoan>,
        loan_id: u32,
        principal: u64,
        apr_bps: u16,
        maturity_ts: i64,
        borrower: Pubkey,
    ) -> Result<()> {
        instructions::initialize_loan_handler(
            ctx,
            loan_id,
            principal,
            apr_bps,
            maturity_ts,
            borrower,
        )
    }

    pub fn deposit(ctx: Context<Deposit>, tranche_kind: u8, usdc_amount: u64) -> Result<()> {
        instructions::deposit_handler(ctx, tranche_kind, usdc_amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, tranche_kind: u8, share_amount: u64) -> Result<()> {
        instructions::withdraw_handler(ctx, tranche_kind, share_amount)
    }

    pub fn accrue_yield(ctx: Context<AccrueYield>, yield_amount: u64) -> Result<()> {
        instructions::accrue_yield_handler(ctx, yield_amount)
    }

    pub fn trigger_credit_event(
        ctx: Context<TriggerCreditEvent>,
        event_type: u8,
        loss_amount: u64,
        severity_bps: u16,
    ) -> Result<()> {
        instructions::trigger_credit_event_handler(ctx, event_type, loss_amount, severity_bps)
    }

    pub fn disburse_loan(ctx: Context<DisburseLoan>) -> Result<()> {
        instructions::disburse_loan_handler(ctx)
    }

    pub fn repay_loan(ctx: Context<RepayLoan>, amount: u64) -> Result<()> {
        instructions::repay_loan_handler(ctx, amount)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause_handler(ctx)
    }

    pub fn unpause(ctx: Context<Pause>) -> Result<()> {
        instructions::unpause_handler(ctx)
    }

    // ── IKA collateral instructions ────────────────────────────────────────

    pub fn attach_ika_collateral(
        ctx: Context<AttachIkaCollateral>,
        dwallet_id: [u8; 32],
        chain_id: u8,
        collateral_amount_usd: u64,
        oracle_pubkey: Pubkey,
    ) -> Result<()> {
        instructions::attach_ika_collateral_handler(
            ctx,
            dwallet_id,
            chain_id,
            collateral_amount_usd,
            oracle_pubkey,
        )
    }

    /// Must be called as instruction index 1 in a tx where index 0 is an
    /// ed25519 native-program instruction containing the oracle's signature.
    pub fn verify_ika_collateral(ctx: Context<VerifyIkaCollateral>) -> Result<()> {
        instructions::verify_ika_collateral_handler(ctx)
    }

    pub fn release_ika_collateral(ctx: Context<ReleaseIkaCollateral>) -> Result<()> {
        instructions::release_ika_collateral_handler(ctx)
    }

    pub fn liquidate_ika_collateral(ctx: Context<LiquidateIkaCollateral>) -> Result<()> {
        instructions::liquidate_ika_collateral_handler(ctx)
    }
}
