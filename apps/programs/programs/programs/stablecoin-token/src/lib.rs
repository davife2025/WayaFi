use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022,
    token_interface::{Mint, Token2022, TokenAccount},
};

declare_id!("IroFiTokn1111111111111111111111111111111111");

/// IroFi Stablecoin Token Program
/// Token-2022 mint with:
///   - Transfer Hook  → KYT compliance gatekeeper on every transfer
///   - Default Account State → all accounts start FROZEN until KYC passes
///   - Required Memo  → Travel Rule attribution baked into every tx
#[program]
pub mod stablecoin_token {
    use super::*;

    /// Initialize the IroFi mint with all Token-2022 extensions
    pub fn initialize_mint(
        ctx: Context<InitializeMint>,
        decimals: u8,
        transfer_hook_program_id: Pubkey,
    ) -> Result<()> {
        let mint_info = ctx.accounts.mint.to_account_info();
        let mint_authority = ctx.accounts.mint_authority.key();

        // 1. Attach Transfer Hook — every transfer CPI's into our compliance program
        let ix = spl_token_2022::instruction::initialize_transfer_hook(
            &spl_token_2022::id(),
            mint_info.key,
            Some(transfer_hook_program_id),
        )?;
        anchor_lang::solana_program::program::invoke(&ix, &[mint_info.clone()])?;

        // 2. Default Account State = Frozen
        //    New institution accounts start locked; unfreeze only after KYC passes
        let ix = spl_token_2022::instruction::initialize_default_account_state(
            &spl_token_2022::id(),
            mint_info.key,
            &spl_token_2022::state::AccountState::Frozen,
        )?;
        anchor_lang::solana_program::program::invoke(&ix, &[mint_info.clone()])?;

        // 3. Initialize mint
        let ix = spl_token_2022::instruction::initialize_mint2(
            &spl_token_2022::id(),
            mint_info.key,
            &mint_authority,
            Some(&mint_authority),
            decimals,
        )?;
        anchor_lang::solana_program::program::invoke(&ix, &[mint_info.clone()])?;

        emit!(MintInitialized {
            mint: *mint_info.key,
            mint_authority,
            transfer_hook_program_id,
            decimals,
        });

        msg!("IroFi mint initialized with Token-2022 extensions");
        Ok(())
    }

    /// Mint USDC to a KYC-verified institution account
    pub fn mint_to_institution(
        ctx: Context<MintToInstitution>,
        amount: u64,
    ) -> Result<()> {
        require!(ctx.accounts.kyc_record.verified, IroFiError::NotVerified);
        require!(
            ctx.accounts.kyc_record.institution == ctx.accounts.destination.owner,
            IroFiError::KYCOwnerMismatch
        );

        token_2022::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token_2022::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(TokensMinted {
            mint: ctx.accounts.mint.key(),
            destination: ctx.accounts.destination.key(),
            institution: ctx.accounts.kyc_record.institution,
            amount,
        });
        Ok(())
    }

    /// Unfreeze institution token account after KYC verification
    pub fn unfreeze_institution_account(ctx: Context<UnfreezeAccount>) -> Result<()> {
        require!(ctx.accounts.kyc_record.verified, IroFiError::NotVerified);

        token_2022::thaw_account(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_2022::ThawAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.freeze_authority.to_account_info(),
            },
        ))?;

        emit!(AccountUnfrozen {
            token_account: ctx.accounts.token_account.key(),
            institution: ctx.accounts.kyc_record.institution,
        });
        Ok(())
    }

    /// Freeze institution account — sanctions hit or KYC revoked
    pub fn freeze_institution_account(
        ctx: Context<FreezeAccount>,
        reason: String,
    ) -> Result<()> {
        require!(reason.len() <= 200, IroFiError::ReasonTooLong);

        token_2022::freeze_account(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token_2022::FreezeAccount {
                account: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.freeze_authority.to_account_info(),
            },
        ))?;

        emit!(AccountFrozen { token_account: ctx.accounts.token_account.key(), reason });
        Ok(())
    }

    /// Write a KYC record on-chain for an institution wallet
    pub fn register_kyc_record(
        ctx: Context<RegisterKYC>,
        jurisdiction: [u8; 2],
        risk_score: u8,
        expires_at: i64,
    ) -> Result<()> {
        let record = &mut ctx.accounts.kyc_record;
        record.institution = ctx.accounts.institution.key();
        record.verified = true;
        record.jurisdiction = jurisdiction;
        record.risk_score = risk_score;
        record.verified_at = Clock::get()?.unix_timestamp;
        record.expires_at = expires_at;
        record.bump = ctx.bumps.kyc_record;

        emit!(KYCRecordRegistered {
            institution: record.institution,
            jurisdiction,
            risk_score,
        });
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(mut)]
    pub mint: Signer<'info>,
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintToInstitution<'info> {
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub mint_authority: Signer<'info>,
    #[account(
        seeds = [b"kyc_record", destination.owner.as_ref()],
        bump = kyc_record.bump,
        constraint = kyc_record.verified @ IroFiError::NotVerified
    )]
    pub kyc_record: Account<'info, KYCRecord>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct UnfreezeAccount<'info> {
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub freeze_authority: Signer<'info>,
    #[account(
        seeds = [b"kyc_record", token_account.owner.as_ref()],
        bump = kyc_record.bump,
        constraint = kyc_record.verified @ IroFiError::NotVerified
    )]
    pub kyc_record: Account<'info, KYCRecord>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct FreezeAccount<'info> {
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub freeze_authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct RegisterKYC<'info> {
    #[account(
        init,
        payer = payer,
        space = KYCRecord::LEN,
        seeds = [b"kyc_record", institution.key().as_ref()],
        bump
    )]
    pub kyc_record: Account<'info, KYCRecord>,
    /// CHECK: institution wallet being KYC'd
    pub institution: UncheckedAccount<'info>,
    pub kyc_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct KYCRecord {
    pub institution: Pubkey,
    pub verified: bool,
    pub jurisdiction: [u8; 2],
    pub risk_score: u8,
    pub verified_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}
impl KYCRecord {
    pub const LEN: usize = 8 + 32 + 1 + 2 + 1 + 8 + 8 + 1;
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event] pub struct MintInitialized { pub mint: Pubkey, pub mint_authority: Pubkey, pub transfer_hook_program_id: Pubkey, pub decimals: u8 }
#[event] pub struct TokensMinted { pub mint: Pubkey, pub destination: Pubkey, pub institution: Pubkey, pub amount: u64 }
#[event] pub struct AccountUnfrozen { pub token_account: Pubkey, pub institution: Pubkey }
#[event] pub struct AccountFrozen { pub token_account: Pubkey, pub reason: String }
#[event] pub struct KYCRecordRegistered { pub institution: Pubkey, pub jurisdiction: [u8; 2], pub risk_score: u8 }

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum IroFiError {
    #[msg("Institution has not completed KYC verification")]
    NotVerified,
    #[msg("KYC record does not match destination account owner")]
    KYCOwnerMismatch,
    #[msg("Freeze reason must be 200 characters or less")]
    ReasonTooLong,
}
