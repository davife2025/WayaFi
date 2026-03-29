use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

declare_id!("HKvGfDBHAXMH3N3xacDKYToFQGfhs7z5zKX8q53DEx8U");

#[program]
pub mod transfer_hook {
    use super::*;

    #[interface(spl_transfer_hook_interface::execute)]
    pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
        let sender = &ctx.accounts.sender_kyc;
        let receiver = &ctx.accounts.receiver_kyc;
        let config = &ctx.accounts.hook_config;
        let now = Clock::get()?.unix_timestamp;

        require!(sender.verified, HookError::SenderNotKYCVerified);
        require!(sender.expires_at > now, HookError::SenderKYCExpired);
        require!(receiver.verified, HookError::ReceiverNotKYCVerified);
        require!(receiver.expires_at > now, HookError::ReceiverKYCExpired);
        require!(!sender.is_sanctioned, HookError::SenderSanctioned);
        require!(!receiver.is_sanctioned, HookError::ReceiverSanctioned);
        require!(amount <= config.max_single_transfer, HookError::ExceedsTransferLimit);

        let grey: &[[u8; 2]] = &[*b"NG", *b"AO", *b"CM", *b"CD"];
        if grey.contains(&sender.jurisdiction) || grey.contains(&receiver.jurisdiction) {
            require!(sender.risk_score <= config.grey_list_risk_threshold, HookError::GreyListRiskTooHigh);
            require!(receiver.risk_score <= config.grey_list_risk_threshold, HookError::GreyListRiskTooHigh);
        }

        emit!(TransferScreened {
            sender: ctx.accounts.source_account.owner,
            receiver: ctx.accounts.destination_account.owner,
            amount,
            sender_jurisdiction: sender.jurisdiction,
            receiver_jurisdiction: receiver.jurisdiction,
            sender_risk_score: sender.risk_score,
            receiver_risk_score: receiver.risk_score,
            timestamp: now,
        });
        Ok(())
    }

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
        max_single_transfer: u64,
        grey_list_risk_threshold: u8,
    ) -> Result<()> {
        let config = &mut ctx.accounts.hook_config;
        config.mint = ctx.accounts.mint.key();
        config.authority = ctx.accounts.authority.key();
        config.max_single_transfer = max_single_transfer;
        config.grey_list_risk_threshold = grey_list_risk_threshold;
        config.is_active = true;
        config.bump = ctx.bumps.hook_config;
        Ok(())
    }

    pub fn upsert_kyc_record(
        ctx: Context<UpsertKYCRecord>,
        verified: bool,
        jurisdiction: [u8; 2],
        risk_score: u8,
        expires_at: i64,
        is_sanctioned: bool,
    ) -> Result<()> {
        let record = &mut ctx.accounts.kyc_record;
        record.wallet = ctx.accounts.wallet.key();
        record.verified = verified;
        record.jurisdiction = jurisdiction;
        record.risk_score = risk_score;
        record.expires_at = expires_at;
        record.is_sanctioned = is_sanctioned;
        record.updated_at = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.kyc_record;
        Ok(())
    }

    pub fn sanction_wallet(ctx: Context<SanctionWallet>, _reason: String) -> Result<()> {
        ctx.accounts.kyc_record.is_sanctioned = true;
        ctx.accounts.kyc_record.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Execute<'info> {
    pub source_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub destination_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Token-2022 owner
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList PDA
    #[account(seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    #[account(seeds = [b"hook_config", mint.key().as_ref()], bump = hook_config.bump)]
    pub hook_config: Account<'info, HookConfig>,
    #[account(seeds = [b"kyc", source_account.owner.as_ref()], bump = sender_kyc.bump)]
    pub sender_kyc: Account<'info, KYCEntry>,
    #[account(seeds = [b"kyc", destination_account.owner.as_ref()], bump = receiver_kyc.bump)]
    pub receiver_kyc: Account<'info, KYCEntry>,
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(init, payer = payer, space = HookConfig::LEN, seeds = [b"hook_config", mint.key().as_ref()], bump)]
    pub hook_config: Account<'info, HookConfig>,
    /// CHECK: ExtraAccountMetaList PDA
    #[account(mut, seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub authority: Signer<'info>,
    #[account(mut)] pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpsertKYCRecord<'info> {
    #[account(init_if_needed, payer = payer, space = KYCEntry::LEN, seeds = [b"kyc", wallet.key().as_ref()], bump)]
    pub kyc_record: Account<'info, KYCEntry>,
    /// CHECK: wallet being registered
    pub wallet: UncheckedAccount<'info>,
    pub hook_config: Account<'info, HookConfig>,
    pub authority: Signer<'info>,
    #[account(mut)] pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SanctionWallet<'info> {
    #[account(mut, seeds = [b"kyc", kyc_record.wallet.as_ref()], bump = kyc_record.bump)]
    pub kyc_record: Account<'info, KYCEntry>,
    pub hook_config: Account<'info, HookConfig>,
    pub authority: Signer<'info>,
}

#[account]
pub struct HookConfig {
    pub mint: Pubkey, pub authority: Pubkey,
    pub max_single_transfer: u64, pub grey_list_risk_threshold: u8,
    pub is_active: bool, pub bump: u8,
}
impl HookConfig { pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1; }

#[account]
pub struct KYCEntry {
    pub wallet: Pubkey, pub verified: bool, pub jurisdiction: [u8; 2],
    pub risk_score: u8, pub expires_at: i64, pub is_sanctioned: bool,
    pub updated_at: i64, pub bump: u8,
}
impl KYCEntry { pub const LEN: usize = 8 + 32 + 1 + 2 + 1 + 8 + 1 + 8 + 1; }

#[event]
pub struct TransferScreened {
    pub sender: Pubkey, pub receiver: Pubkey, pub amount: u64,
    pub sender_jurisdiction: [u8; 2], pub receiver_jurisdiction: [u8; 2],
    pub sender_risk_score: u8, pub receiver_risk_score: u8, pub timestamp: i64,
}

#[error_code]
pub enum HookError {
    #[msg("Sender not KYC verified")] SenderNotKYCVerified,
    #[msg("Receiver not KYC verified")] ReceiverNotKYCVerified,
    #[msg("Sender KYC expired")] SenderKYCExpired,
    #[msg("Receiver KYC expired")] ReceiverKYCExpired,
    #[msg("Sender is sanctioned")] SenderSanctioned,
    #[msg("Receiver is sanctioned")] ReceiverSanctioned,
    #[msg("Exceeds transfer limit")] ExceedsTransferLimit,
    #[msg("Risk too high for grey-listed corridor")] GreyListRiskTooHigh,
}
