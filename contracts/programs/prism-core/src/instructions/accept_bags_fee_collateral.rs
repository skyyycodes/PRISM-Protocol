use crate::errors::PrismError;
use crate::events::BagsCollateralActivated;
use crate::state::{
    BagsCollateral, BagsCollateralStatus, GlobalConfig, Loan, LoanState, Vault, VaultState,
};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;

/// Bags collateral activation attestation message layout (155 bytes total):
///   b"bgs_atts"           (8)  — fixed prefix
///   bags_token_mint      (32)  — SPL mint of the Bags-launched token
///   creator_wallet       (32)  — Bags token creator / borrower wallet
///   fee_claimer_pda      (32)  — PRISM PDA registered as a fee claimer
///   loan                 (32)  — Solana loan PDA the pledge backs
///   share_bps             (2)  — fee share routed to PRISM PDA (LE)
///   trailing_30d_sol     (8)  — 30-day rolling SOL fee revenue (LE)
///   valuation_usd_micro  (8)  — USD valuation in micros (LE)
///   result               (1)  — 0x01 = oracle confirmed the Bags config
const MSG_PREFIX: &[u8; 8] = b"bgs_atts";
const MSG_LEN: usize = 155;

const ED25519_PROGRAM_ID: Pubkey =
    anchor_lang::solana_program::pubkey!("Ed25519SigVerify111111111111111111111111111");

#[derive(Accounts)]
pub struct AcceptBagsFeeCollateral<'info> {
    /// Borrower (Bags token creator) signs to commit their fee stream.
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(seeds = [b"config2"], bump)]
    pub config: Box<Account<'info, GlobalConfig>>,

    #[account(
        seeds = [b"vault", &vault.id.to_le_bytes()],
        bump = vault.bump,
        constraint = vault.state == VaultState::Active @ PrismError::VaultNotActive,
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(
        has_one = vault,
        constraint = loan.borrower == borrower.key() @ PrismError::BorrowerMismatch,
        constraint = loan.state == LoanState::Originated @ PrismError::LoanInWrongState,
    )]
    pub loan: Box<Account<'info, Loan>>,

    #[account(
        init,
        payer = borrower,
        space = 8 + BagsCollateral::INIT_SPACE,
        seeds = [b"bags_collateral", vault.key().as_ref(), borrower.key().as_ref()],
        bump,
    )]
    pub bags_collateral: Account<'info, BagsCollateral>,

    pub system_program: Program<'info, System>,

    /// CHECK: read-only sysvar; address constraint enforced by Anchor.
    #[account(address = ix_sysvar::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

/// Activate a Bags fee-stream pledge against a loan.
///
/// Must be called as instruction index 1 in a tx where index 0 is an
/// Ed25519 native-program instruction containing the Bags oracle's
/// signature over the 155-byte attestation message above.
///
/// The on-chain logic verifies the attestation, cross-checks every field
/// against the explicit arguments (so the borrower can't pledge a
/// different token than the one in the attestation), and records the
/// collateral in Active state.
pub fn accept_bags_fee_collateral_handler(
    ctx: Context<AcceptBagsFeeCollateral>,
    bags_token_mint: Pubkey,
    fee_claimer_pda: Pubkey,
    share_bps: u16,
    trailing_30d_sol_lamports: u64,
    valuation_usd_micro: u64,
) -> Result<()> {
    require!(
        share_bps > 0 && share_bps <= 10_000,
        PrismError::BagsInvalidShare
    );

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

    // ── 2. Oracle must be in the global allowlist ──────────────────────────
    let signing_key = Pubkey::from(oracle_pk_bytes);
    require!(
        ctx.accounts.config.oracle_allowlist.contains(&signing_key),
        PrismError::OracleNotAllowlisted
    );

    // ── 3. Validate the attestation message ────────────────────────────────
    require!(msg_size == MSG_LEN, PrismError::BagsSignatureInvalid);
    require!(&msg_bytes[0..8] == MSG_PREFIX, PrismError::BagsSignatureInvalid);

    let attested_token: [u8; 32] = msg_bytes[8..40].try_into().unwrap();
    let attested_creator: [u8; 32] = msg_bytes[40..72].try_into().unwrap();
    let attested_claimer: [u8; 32] = msg_bytes[72..104].try_into().unwrap();
    let attested_loan: [u8; 32] = msg_bytes[104..136].try_into().unwrap();
    let attested_share_bps = u16::from_le_bytes(msg_bytes[136..138].try_into().unwrap());
    let attested_30d_sol = u64::from_le_bytes(msg_bytes[138..146].try_into().unwrap());
    let attested_valuation = u64::from_le_bytes(msg_bytes[146..154].try_into().unwrap());
    let result_byte = msg_bytes[154];

    require!(result_byte == 0x01, PrismError::BagsAttestationNotConfirmed);

    require!(
        attested_token == bags_token_mint.to_bytes(),
        PrismError::BagsTokenMintMismatch
    );
    require!(
        attested_creator == ctx.accounts.borrower.key().to_bytes(),
        PrismError::BagsCreatorMismatch
    );
    require!(
        attested_claimer == fee_claimer_pda.to_bytes(),
        PrismError::BagsClaimerMismatch
    );
    require!(
        attested_loan == ctx.accounts.loan.key().to_bytes(),
        PrismError::BagsSignatureInvalid
    );
    require!(
        attested_share_bps == share_bps,
        PrismError::BagsShareMismatch
    );
    require!(
        attested_30d_sol == trailing_30d_sol_lamports,
        PrismError::BagsSignatureInvalid
    );
    require!(
        attested_valuation == valuation_usd_micro,
        PrismError::BagsSignatureInvalid
    );

    // ── 4. Persist BagsCollateral ──────────────────────────────────────────
    let clock = Clock::get()?;
    let col = &mut ctx.accounts.bags_collateral;
    col.loan = ctx.accounts.loan.key();
    col.vault = ctx.accounts.vault.key();
    col.creator_wallet = ctx.accounts.borrower.key();
    col.bags_token_mint = bags_token_mint;
    col.fee_claimer_pda = fee_claimer_pda;
    col.bags_oracle = signing_key;
    col.share_bps = share_bps;
    col.valuation_usd_micro = valuation_usd_micro;
    col.trailing_30d_sol_lamports = trailing_30d_sol_lamports;
    col.cumulative_swept_lamports = 0;
    col.cumulative_swept_usdc = 0;
    col.sweep_seq = 0;
    col.status = BagsCollateralStatus::Active;
    col.activated_ts = clock.unix_timestamp;
    col.last_sweep_ts = 0;
    col.bump = ctx.bumps.bags_collateral;

    emit!(BagsCollateralActivated {
        loan: col.loan,
        vault: col.vault,
        creator_wallet: col.creator_wallet,
        bags_token_mint: col.bags_token_mint,
        fee_claimer_pda: col.fee_claimer_pda,
        share_bps: col.share_bps,
        valuation_usd_micro: col.valuation_usd_micro,
        trailing_30d_sol_lamports: col.trailing_30d_sol_lamports,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "PRISM Bags: collateral activated. token={} share_bps={} valuation_usd_micro={}",
        bags_token_mint,
        share_bps,
        valuation_usd_micro
    );

    Ok(())
}
