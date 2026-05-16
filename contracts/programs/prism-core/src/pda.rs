use crate::ID;
use anchor_lang::prelude::*;

pub fn config_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"config2"], &ID)
}

pub fn vault_pda(vault_id: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault", &vault_id.to_le_bytes()], &ID)
}

pub fn tranche_pda(vault: &Pubkey, kind: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"tranche", vault.as_ref(), &[kind]], &ID)
}

pub fn tranche_mint_pda(vault: &Pubkey, kind: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"mint", vault.as_ref(), &[kind]], &ID)
}

pub fn vault_reserve_pda(vault: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"reserve", vault.as_ref()], &ID)
}

pub fn loss_bucket_pda(vault: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"loss_bucket", vault.as_ref()], &ID)
}

pub fn loan_pda(vault: &Pubkey, loan_id: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"loan", vault.as_ref(), &loan_id.to_le_bytes()], &ID)
}

pub fn credit_event_pda(vault: &Pubkey, seq: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"credit_event", vault.as_ref(), &seq.to_le_bytes()], &ID)
}

pub fn encrypt_health_pda(loan: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"encrypt_health", loan.as_ref()], &ID)
}

pub fn cloak_payout_pda(vault: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"cloak_payout", vault.as_ref()], &ID)
}

pub fn bags_collateral_pda(vault: &Pubkey, creator_wallet: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"bags_collateral", vault.as_ref(), creator_wallet.as_ref()],
        &ID,
    )
}

/// PDA that the Bags fee-share config routes this token's `share_bps` of
/// trading fees to. The protocol-controlled receiver for a given loan's
/// fee-stream collateral.
pub fn bags_fee_claimer_pda(vault: &Pubkey, creator_wallet: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"bags_claimer", vault.as_ref(), creator_wallet.as_ref()],
        &ID,
    )
}
