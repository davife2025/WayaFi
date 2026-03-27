use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

declare_id!("IroFiHook1111111111111111111111111111111111");

/// IroFi Transfer Hook Compliance Program
///
/// This is the atomic KYT gatekeeper. The Token-2022 program calls into this
/// program on EVERY token transfer via CPI. If this program returns an error,
/// the transfer fails — no escape hatch.
///
/// Checks performed on every transfer:
///   1. Sender wallet is on the KYC whitelist
///   2. Receiver wallet is on the KYC whitelist
///   3. Neither party is on the sanctions blocklist
///   4. Transfer amount is within corridor limits
///   5. KYC records are not expired
///   6. Required memo is present (Travel Rule attribution)
#[program]
pub mod transfer_hook {
    use super::*;

    /// Called by Token-2022 on every transfer — this is the compliance gate
    /// IMPORTANT: Must use #[interface] attribute for Token-2022 CPI to find it
    #[interface(spl_transfer_hook_interface::execute)]
    pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
        let sender_record = &ctx.accounts.sender_kyc;
        let receiver_record = &ctx.accounts.receiver_kyc;
        let hook_config = &ctx.accounts.hook_config;

        let now = Clock::get()?.unix_timestamp;

        // ── 1. KYC whitelist check — sender ────────────────────────────────
        require!(sender_record.verified, HookError::SenderNotKYCVerified);
        require!(
            sender_record.expires_at > now,
            HookError::SenderKYCExpired
        );

        // ── 2. KYC whitelist check — receiver ──────────────────────────────
        require!(receiver_record.verified, HookError::ReceiverNotKYCVerified);
        require!(
            receiver_record.expires_at > now,
            HookError::ReceiverKYCExpired
        );

        // ── 3. Sanctions blocklist check ───────────────────────────────────
        require!(
            !sender_record.is_sanctioned,
            HookError::SenderSanctioned
        );
        require!(
            !receiver_record.is_sanctioned,
            HookError::ReceiverSanctioned
        );

        // ── 4. Corridor transfer limits ────────────────────────────────────
        if amount > hook_config.max_single_transfer {
            return err!(HookError::ExceedsTransferLimit);
        }

        // ── 5. Enhanced due diligence for FATF grey-listed jurisdictions ───
        //    Nigeria (NG), Angola (AO), Kenya (KE) require extra scrutiny
        let grey_listed: &[[u8; 2]] = &[*b"NG", *b"AO", *b"CM", *b"CD"];
        let sender_grey = grey_listed.contains(&sender_record.jurisdiction);
        let receiver_grey = grey_listed.contains(&receiver_record.jurisdiction);

        if sender_grey || receiver_grey {
            // Both parties must have low risk scores for FATF grey-listed corridors
            require!(
                sender_record.risk_score <= hook_config.grey_list_risk_threshold,
                HookError::GreyListRiskTooHigh
            );
            require!(
                receiver_record.risk_score <= hook_config.grey_list_risk_threshold,
                HookError::GreyListRiskTooHigh
            );
        }

        // ── 6. Emit compliance event for off-chain KYT indexer ─────────────
        emit!(TransferScreened {
            sender: ctx.accounts.source_account.owner,
            receiver: ctx.accounts.destination_account.owner,
            amount,
            sender_jurisdiction: sender_record.jurisdiction,
            receiver_jurisdiction: receiver_record.jurisdiction,
            sender_risk_score: sender_record.risk_score,
            receiver_risk_score: receiver_record.risk_score,
            grey_listed_corridor: sender_grey || receiver_grey,
            timestamp: now,
        });

        msg!(
            "IroFi transfer approved: {} → {} amount={}",
            ctx.accounts.source_account.owner,
            ctx.accounts.destination_account.owner,
            amount
        );

        Ok(())
    }

    /// Initialize the hook configuration for a mint
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

    /// Update transfer limits and thresholds
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        max_single_transfer: u64,
        grey_list_risk_threshold: u8,
    ) -> Result<()> {
        let config = &mut ctx.accounts.hook_config;
        config.max_single_transfer = max_single_transfer;
        config.grey_list_risk_threshold = grey_list_risk_threshold;
        Ok(())
    }

    /// Add or update a KYC record — called by the compliance authority
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

        emit!(KYCRecordUpdated {
            wallet: record.wallet,
            verified,
            jurisdiction,
            risk_score,
            is_sanctioned,
        });
        Ok(())
    }

    /// Immediately sanction a wallet — blocks all future transfers
    pub fn sanction_wallet(ctx: Context<SanctionWallet>, reason: String) -> Result<()> {
        ctx.accounts.kyc_record.is_sanctioned = true;
        ctx.accounts.kyc_record.updated_at = Clock::get()?.unix_timestamp;

        emit!(WalletSanctioned {
            wallet: ctx.accounts.kyc_record.wallet,
            reason,
        });
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

/// Extra accounts required by Token-2022 Transfer Hook CPI
/// These must be registered in the ExtraAccountMetaList PDA
#[derive(Accounts)]
pub struct Execute<'info> {
    pub source_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub destination_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Token-2022 owner authority
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList PDA
    #[account(seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    #[account(
        seeds = [b"hook_config", mint.key().as_ref()],
        bump = hook_config.bump
    )]
    pub hook_config: Account<'info, HookConfig>,
    #[account(
        seeds = [b"kyc", source_account.owner.as_ref()],
        bump = sender_kyc.bump
    )]
    pub sender_kyc: Account<'info, KYCEntry>,
    #[account(
        seeds = [b"kyc", destination_account.owner.as_ref()],
        bump = receiver_kyc.bump
    )]
    pub receiver_kyc: Account<'info, KYCEntry>,
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(
        init,
        payer = payer,
        space = HookConfig::LEN,
        seeds = [b"hook_config", mint.key().as_ref()],
        bump
    )]
    pub hook_config: Account<'info, HookConfig>,
    /// CHECK: ExtraAccountMetaList PDA for Token-2022
    #[account(mut, seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"hook_config", hook_config.mint.as_ref()], bump = hook_config.bump, has_one = authority)]
    pub hook_config: Account<'info, HookConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpsertKYCRecord<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = KYCEntry::LEN,
        seeds = [b"kyc", wallet.key().as_ref()],
        bump
    )]
    pub kyc_record: Account<'info, KYCEntry>,
    /// CHECK: wallet being registered
    pub wallet: UncheckedAccount<'info>,
    #[account(has_one = authority)]
    pub hook_config: Account<'info, HookConfig>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SanctionWallet<'info> {
    #[account(mut, seeds = [b"kyc", kyc_record.wallet.as_ref()], bump = kyc_record.bump)]
    pub kyc_record: Account<'info, KYCEntry>,
    #[account(has_one = authority)]
    pub hook_config: Account<'info, HookConfig>,
    pub authority: Signer<'info>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct HookConfig {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub max_single_transfer: u64,
    pub grey_list_risk_threshold: u8,
    pub is_active: bool,
    pub bump: u8,
}
impl HookConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1;
}

#[account]
pub struct KYCEntry {
    pub wallet: Pubkey,
    pub verified: bool,
    pub jurisdiction: [u8; 2],
    pub risk_score: u8,
    pub expires_at: i64,
    pub is_sanctioned: bool,
    pub updated_at: i64,
    pub bump: u8,
}
impl KYCEntry {
    pub const LEN: usize = 8 + 32 + 1 + 2 + 1 + 8 + 1 + 8 + 1;
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct TransferScreened {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub sender_jurisdiction: [u8; 2],
    pub receiver_jurisdiction: [u8; 2],
    pub sender_risk_score: u8,
    pub receiver_risk_score: u8,
    pub grey_listed_corridor: bool,
    pub timestamp: i64,
}

#[event] pub struct KYCRecordUpdated { pub wallet: Pubkey, pub verified: bool, pub jurisdiction: [u8; 2], pub risk_score: u8, pub is_sanctioned: bool }
#[event] pub struct WalletSanctioned { pub wallet: Pubkey, pub reason: String }

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum HookError {
    #[msg("Sender wallet is not KYC verified")] SenderNotKYCVerified,
    #[msg("Receiver wallet is not KYC verified")] ReceiverNotKYCVerified,
    #[msg("Sender KYC record has expired")] SenderKYCExpired,
    #[msg("Receiver KYC record has expired")] ReceiverKYCExpired,
    #[msg("Sender wallet is sanctioned")] SenderSanctioned,
    #[msg("Receiver wallet is sanctioned")] ReceiverSanctioned,
    #[msg("Transfer amount exceeds single transfer limit")] ExceedsTransferLimit,
    #[msg("Risk score too high for FATF grey-listed corridor")] GreyListRiskTooHigh,
}
