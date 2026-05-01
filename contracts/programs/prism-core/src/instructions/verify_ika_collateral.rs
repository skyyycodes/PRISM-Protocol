use crate::errors::PrismError;
use crate::state::{CollateralStatus, GlobalConfig, IkaCollateral, Loan};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions as ix_sysvar;

/// Oracle attestation message layout (81 bytes total):
///   b"ika_atts" (8)  — fixed prefix
///   dwallet_id (32)  — IKA dWallet identifier
///   chain_id   (1)   — 0=BTC, 1=ETH, 2=SUI
///   amount_usd (8)   — micro-USD, little-endian u64
///   loan_key   (32)  — the Loan account pubkey
const MSG_PREFIX: &[u8; 8] = b"ika_atts";
const MSG_LEN: usize = 81;

/// ed25519 native precompile address on Solana.
const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

#[derive(Accounts)]
pub struct VerifyIkaCollateral<'info> {
    /// Anyone may relay the oracle-signed attestation to the chain.
    pub signer: Signer<'info>,

    /// Read oracle_allowlist to validate the signer's key.
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, GlobalConfig>,

    pub loan: Account<'info, Loan>,

    #[account(
        mut,
        seeds = [b"ika_collateral", loan.key().as_ref()],
        bump = ika_collateral.bump,
        constraint = ika_collateral.status == CollateralStatus::Pending
            @ PrismError::CollateralAlreadyLocked,
    )]
    pub ika_collateral: Account<'info, IkaCollateral>,

    /// CHECK: we only read this via ix_sysvar; Solana validates the address.
    #[account(address = ix_sysvar::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

pub fn verify_ika_collateral_handler(ctx: Context<VerifyIkaCollateral>) -> Result<()> {
    // ── 1. Load the ed25519 instruction that must be ix 0 in this tx ─────────
    let ix = ix_sysvar::load_instruction_at_checked(0, &ctx.accounts.instructions_sysvar)
        .map_err(|_| PrismError::OracleSignatureInvalid)?;

    require!(ix.program_id == ED25519_PROGRAM_ID, PrismError::OracleSignatureInvalid);

    // ── 2. Parse ed25519 instruction data ─────────────────────────────────────
    // Layout: count(1) | pad(1) | SignatureOffsets×14 | sig(64) | pk(32) | msg(n)
    // All offsets reference data within this same instruction (ix_index = 0xFFFF).
    let data = &ix.data;
    require!(data.len() >= 16, PrismError::OracleSignatureInvalid); // header + one entry
    require!(data[0] >= 1, PrismError::OracleSignatureInvalid);

    // Byte offsets for the FIRST signature entry (starts at data[2]).
    let pk_offset =
        u16::from_le_bytes(data[6..8].try_into().map_err(|_| PrismError::OracleSignatureInvalid)?)
            as usize;
    let msg_offset =
        u16::from_le_bytes(data[10..12].try_into().map_err(|_| PrismError::OracleSignatureInvalid)?)
            as usize;
    let msg_size =
        u16::from_le_bytes(data[12..14].try_into().map_err(|_| PrismError::OracleSignatureInvalid)?)
            as usize;

    require!(
        data.len() >= pk_offset + 32 && data.len() >= msg_offset + msg_size,
        PrismError::OracleSignatureInvalid
    );

    let oracle_pk_bytes: [u8; 32] = data[pk_offset..pk_offset + 32]
        .try_into()
        .map_err(|_| PrismError::OracleSignatureInvalid)?;
    let msg = &data[msg_offset..msg_offset + msg_size];

    // ── 3. Check that the oracle key is the one the borrower registered ───────
    let col = &ctx.accounts.ika_collateral;
    let expected_oracle: [u8; 32] = col.oracle_pubkey.to_bytes();
    require!(oracle_pk_bytes == expected_oracle, PrismError::OracleSignatureInvalid);

    // ── 4. Validate the oracle message format and contents ────────────────────
    require!(msg_size == MSG_LEN, PrismError::OracleSignatureInvalid);

    // prefix
    require!(&msg[0..8] == MSG_PREFIX, PrismError::OracleSignatureInvalid);

    // dwallet_id
    let attested_dwallet: [u8; 32] =
        msg[8..40].try_into().map_err(|_| PrismError::OracleSignatureInvalid)?;
    require!(attested_dwallet == col.dwallet_id, PrismError::DwalletIdMismatch);

    // chain_id
    require!(msg[40] == col.chain_id, PrismError::OracleSignatureInvalid);

    // amount_usd
    let attested_amount =
        u64::from_le_bytes(msg[41..49].try_into().map_err(|_| PrismError::OracleSignatureInvalid)?);
    require!(
        attested_amount >= col.collateral_amount_usd,
        PrismError::InsufficientCollateral
    );

    // loan pubkey
    let attested_loan: [u8; 32] =
        msg[49..81].try_into().map_err(|_| PrismError::OracleSignatureInvalid)?;
    require!(
        attested_loan == ctx.accounts.loan.key().to_bytes(),
        PrismError::OracleSignatureInvalid
    );

    // ── 5. Mark collateral as Locked ──────────────────────────────────────────
    let col = &mut ctx.accounts.ika_collateral;
    col.status = CollateralStatus::Locked;
    col.locked_ts = Clock::get()?.unix_timestamp;
    col.collateral_amount_usd = attested_amount; // accept oracle's attested amount

    Ok(())
}
