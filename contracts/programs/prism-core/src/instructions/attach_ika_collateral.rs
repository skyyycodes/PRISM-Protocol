use crate::errors::PrismError;
use crate::state::{CollateralStatus, IkaCollateral, Loan, LoanState};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AttachIkaCollateral<'info> {
    /// The borrower must sign — only the named borrower can attach collateral to their loan.
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(
        constraint = loan.borrower == borrower.key() @ PrismError::BorrowerMismatch,
        constraint = loan.state == LoanState::Originated @ PrismError::LoanInWrongState,
    )]
    pub loan: Account<'info, Loan>,

    #[account(
        init,
        payer = borrower,
        space = 8 + IkaCollateral::INIT_SPACE,
        seeds = [b"ika_collateral", loan.key().as_ref()],
        bump,
    )]
    pub ika_collateral: Account<'info, IkaCollateral>,

    pub system_program: Program<'info, System>,
}

/// Register intent to use an IKA dWallet as collateral for `loan`.
///
/// The collateral starts in `Pending` status. The borrower must follow up with
/// `verify_ika_collateral` (which requires a live oracle attestation) before
/// the loan can be disbursed through the collateralized path.
pub fn attach_ika_collateral_handler(
    ctx: Context<AttachIkaCollateral>,
    dwallet_id: [u8; 32],
    chain_id: u8,
    collateral_amount_usd: u64,
    oracle_pubkey: Pubkey,
) -> Result<()> {
    require!(chain_id <= 2, PrismError::InvalidTrancheKind); // 0=BTC 1=ETH 2=SUI

    let col = &mut ctx.accounts.ika_collateral;
    col.loan = ctx.accounts.loan.key();
    col.dwallet_id = dwallet_id;
    col.chain_id = chain_id;
    col.collateral_amount_usd = collateral_amount_usd;
    col.status = CollateralStatus::Pending;
    col.oracle_pubkey = oracle_pubkey;
    col.locked_ts = 0;
    col.bump = ctx.bumps.ika_collateral;

    Ok(())
}
