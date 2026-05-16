use crate::errors::PrismError;
use crate::events::BagsFeesSwept;
use crate::state::{BagsCollateral, BagsCollateralStatus, GlobalConfig, Loan, Vault};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;

/// Bags sweep attestation message layout (77 bytes total):
///   b"bgs_swep"          (8)  — fixed prefix
///   bags_collateral     (32)  — collateral PDA being credited
///   sweep_seq            (4)  — monotonic counter (LE) — replay protection
///   sol_lamports         (8)  — SOL fees claimed off-chain (LE)
///   usdc_amount          (8)  — USDC equivalent applied to loan (LE)
///   cumulative_lamports  (8)  — running total since activation (LE)
///   cumulative_usdc      (8)  — running total USDC applied (LE)
///   result               (1)  — 0x01 = oracle confirmed off-chain settlement
const MSG_PREFIX: &[u8; 8] = b"bgs_swep";
const MSG_LEN: usize = 77;

const ED25519_PROGRAM_ID: Pubkey =
    anchor_lang::solana_program::pubkey!("Ed25519SigVerify111111111111111111111111111");

#[derive(Accounts)]
pub struct ClaimAndSettleBagsFees<'info> {
    /// Keeper signs (any allowlisted relayer; oracle attestation provides auth).
    #[account(mut)]
    pub keeper: Signer<'info>,

    #[account(seeds = [b"config2"], bump)]
    pub config: Box<Account<'info, GlobalConfig>>,

    #[account(seeds = [b"vault", &vault.id.to_le_bytes()], bump = vault.bump)]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        mut,
        has_one = vault,
    )]
    pub loan: Box<Account<'info, Loan>>,

    #[account(
        mut,
        seeds = [b"bags_collateral", vault.key().as_ref(), bags_collateral.creator_wallet.as_ref()],
        bump = bags_collateral.bump,
        constraint = bags_collateral.status == BagsCollateralStatus::Active
            @ PrismError::BagsCollateralNotActive,
        constraint = bags_collateral.loan == loan.key() @ PrismError::BorrowerMismatch,
    )]
    pub bags_collateral: Account<'info, BagsCollateral>,

    /// CHECK: read-only sysvar; address constraint enforced by Anchor.
    #[account(address = ix_sysvar::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

/// Record a Bags fee sweep against a loan.
///
/// The off-chain keeper:
///   1. Calls `getClaimablePositions` for the Bags fee_claimer_pda
///   2. Builds + sends the Bags claim transaction (SOL → claimer's wallet)
///   3. Swaps SOL → USDC (Jupiter / Bags trade quote)
///   4. Calls the existing `repay_loan` instruction to apply the USDC
///   5. Calls THIS instruction with a Bags-oracle attestation recording the sweep
///
/// This instruction does NOT move USDC — it only records the sweep and
/// updates the BagsCollateral counters. Keep the USDC transfer in
/// `repay_loan` so the vault reserve invariant stays maintained.
///
/// Must be called as instruction index 1 in a tx where index 0 is an
/// Ed25519 native-program instruction containing the Bags oracle's
/// signature over the 77-byte attestation message above.
pub fn claim_and_settle_bags_fees_handler(ctx: Context<ClaimAndSettleBagsFees>) -> Result<()> {
    // ── 1. Locate the Ed25519 precompile instruction ───────────────────────
    let sysvar_info = &ctx.accounts.instructions_sysvar;
    let mut ed_ix = None;
    for i in 0..10 {
        if let Ok(ix) = ix_sysvar::load_instruction_at_checked(i, sysvar_info) {
            if ix.program_id == ED25519_PROGRAM_ID {
                ed_ix = Some(ix);
                break;
            }
        }
    }
    let ix = ed_ix.ok_or_else(|| {
        msg!("Bags: Ed25519 precompile instruction not found");
        PrismError::BagsSignatureInvalid
    })?;

    let data = &ix.data;
    require!(data.len() >= 16, PrismError::BagsSignatureInvalid);

    let pk_offset = u16::from_le_bytes(data[6..8].try_into().unwrap()) as usize;
    let msg_offset = u16::from_le_bytes(data[10..12].try_into().unwrap()) as usize;
    let msg_size = u16::from_le_bytes(data[12..14].try_into().unwrap()) as usize;

    let oracle_pk_bytes: [u8; 32] = data[pk_offset..pk_offset + 32].try_into().unwrap();
    let msg_bytes = &data[msg_offset..msg_offset + msg_size];

    // ── 2. Oracle must be the one that activated this collateral ───────────
    let signing_key = Pubkey::from(oracle_pk_bytes);
    require!(
        ctx.accounts.config.oracle_allowlist.contains(&signing_key),
        PrismError::OracleNotAllowlisted
    );
    require!(
        signing_key == ctx.accounts.bags_collateral.bags_oracle,
        PrismError::BagsSignatureInvalid
    );

    // ── 3. Validate the attestation message ────────────────────────────────
    require!(msg_size == MSG_LEN, PrismError::BagsSignatureInvalid);
    require!(&msg_bytes[0..8] == MSG_PREFIX, PrismError::BagsSignatureInvalid);

    let attested_col: [u8; 32] = msg_bytes[8..40].try_into().unwrap();
    let sweep_seq = u32::from_le_bytes(msg_bytes[40..44].try_into().unwrap());
    let sol_lamports = u64::from_le_bytes(msg_bytes[44..52].try_into().unwrap());
    let usdc_amount = u64::from_le_bytes(msg_bytes[52..60].try_into().unwrap());
    let cumulative_lamports = u64::from_le_bytes(msg_bytes[60..68].try_into().unwrap());
    let cumulative_usdc = u64::from_le_bytes(msg_bytes[68..76].try_into().unwrap());
    let result_byte = msg_bytes[76];

    require!(result_byte == 0x01, PrismError::BagsAttestationNotConfirmed);

    require!(
        attested_col == ctx.accounts.bags_collateral.key().to_bytes(),
        PrismError::BagsSignatureInvalid
    );

    // ── 4. Replay protection ───────────────────────────────────────────────
    let col = &mut ctx.accounts.bags_collateral;
    require!(sweep_seq > col.sweep_seq, PrismError::BagsSweepReplayed);

    // ── 5. Consistency: cumulative counters must move forward by the
    //       reported deltas. Prevents the oracle from drifting state.
    require!(
        cumulative_lamports
            == col
                .cumulative_swept_lamports
                .checked_add(sol_lamports)
                .ok_or(PrismError::ArithmeticOverflow)?,
        PrismError::BagsSignatureInvalid
    );
    require!(
        cumulative_usdc
            == col
                .cumulative_swept_usdc
                .checked_add(usdc_amount)
                .ok_or(PrismError::ArithmeticOverflow)?,
        PrismError::BagsSignatureInvalid
    );

    // ── 6. Persist ─────────────────────────────────────────────────────────
    let clock = Clock::get()?;
    col.sweep_seq = sweep_seq;
    col.cumulative_swept_lamports = cumulative_lamports;
    col.cumulative_swept_usdc = cumulative_usdc;
    col.last_sweep_ts = clock.unix_timestamp;

    emit!(BagsFeesSwept {
        loan: ctx.accounts.loan.key(),
        vault: ctx.accounts.vault.key(),
        bags_token_mint: col.bags_token_mint,
        sweep_seq,
        sol_lamports_claimed: sol_lamports,
        usdc_applied: usdc_amount,
        cumulative_swept_lamports: cumulative_lamports,
        cumulative_swept_usdc: cumulative_usdc,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "PRISM Bags: swept seq={} sol_lamports={} usdc_applied={}",
        sweep_seq,
        sol_lamports,
        usdc_amount
    );

    Ok(())
}
