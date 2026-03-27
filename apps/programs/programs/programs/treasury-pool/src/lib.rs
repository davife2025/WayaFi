use anchor_lang::prelude::*;
use anchor_spl::{token_2022, token_interface::{Mint, Token2022, TokenAccount}};

declare_id!("IroFiPool1111111111111111111111111111111111");

/// IroFi Treasury Pool Program
/// Manages institutional USDC liquidity across African corridors.
/// Replaces the nostro/vostro pre-funding model — institutions deposit once,
/// route globally, no pre-funding per corridor required.
#[program]
pub mod treasury_pool {
    use super::*;

    /// Initialize a new corridor pool (e.g. NG_KE, NG_ZA, NG_GH)
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        corridor: [u8; 5],   // e.g. b"NG_KE"
        min_liquidity: u64,
        transfer_fee_bps: u16, // basis points e.g. 50 = 0.5%
    ) -> Result<()> {
        require!(transfer_fee_bps <= 500, PoolError::FeeTooHigh); // max 5%

        let pool = &mut ctx.accounts.pool;
        pool.corridor = corridor;
        pool.authority = ctx.accounts.authority.key();
        pool.vault = ctx.accounts.vault.key();
        pool.total_deposits = 0;
        pool.total_settled = 0;
        pool.pending_settlements = 0;
        pool.min_liquidity = min_liquidity;
        pool.transfer_fee_bps = transfer_fee_bps;
        pool.is_active = true;
        pool.bump = ctx.bumps.pool;

        emit!(PoolInitialized {
            corridor,
            authority: pool.authority,
            transfer_fee_bps,
        });
        Ok(())
    }

    /// Institution deposits USDC into the corridor pool
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(ctx.accounts.pool.is_active, PoolError::PoolInactive);
        require!(amount > 0, PoolError::ZeroAmount);

        token_2022::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token_2022::TransferChecked {
                    from: ctx.accounts.institution_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.institution.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        let pool = &mut ctx.accounts.pool;
        pool.total_deposits = pool.total_deposits.checked_add(amount).unwrap();

        // Update institution's position
        let position = &mut ctx.accounts.institution_position;
        position.institution = ctx.accounts.institution.key();
        position.pool = pool.key();
        position.deposited = position.deposited.checked_add(amount).unwrap();
        position.last_deposit_at = Clock::get()?.unix_timestamp;

        emit!(DepositMade {
            pool: pool.key(),
            corridor: pool.corridor,
            institution: ctx.accounts.institution.key(),
            amount,
            new_pool_total: pool.total_deposits,
        });
        Ok(())
    }

    /// Initiate a cross-border settlement — locks funds pending compliance checks
    pub fn initiate_settlement(
        ctx: Context<InitiateSettlement>,
        amount: u64,
        receiver_institution: Pubkey,
        memo: String,          // Travel Rule reference — required memo
        idempotency_key: [u8; 32],
    ) -> Result<()> {
        require!(ctx.accounts.pool.is_active, PoolError::PoolInactive);
        require!(amount > 0, PoolError::ZeroAmount);
        require!(memo.len() >= 8 && memo.len() <= 512, PoolError::InvalidMemo);

        let pool = &ctx.accounts.pool;
        let available = pool.total_deposits
            .checked_sub(pool.pending_settlements)
            .unwrap_or(0);
        require!(available >= amount, PoolError::InsufficientLiquidity);
        require!(available.saturating_sub(amount) >= pool.min_liquidity, PoolError::BelowMinLiquidity);

        // Calculate fee
        let fee = (amount as u128)
            .checked_mul(pool.transfer_fee_bps as u128).unwrap()
            .checked_div(10_000).unwrap() as u64;
        let net_amount = amount.checked_sub(fee).unwrap();

        let settlement = &mut ctx.accounts.settlement;
        settlement.pool = pool.key();
        settlement.corridor = pool.corridor;
        settlement.sender_institution = ctx.accounts.sender_institution.key();
        settlement.receiver_institution = receiver_institution;
        settlement.amount = amount;
        settlement.fee = fee;
        settlement.net_amount = net_amount;
        settlement.memo = memo.clone();
        settlement.idempotency_key = idempotency_key;
        settlement.status = SettlementStatus::Pending;
        settlement.initiated_at = Clock::get()?.unix_timestamp;
        settlement.bump = ctx.bumps.settlement;

        // Lock funds
        let pool = &mut ctx.accounts.pool;
        pool.pending_settlements = pool.pending_settlements.checked_add(amount).unwrap();

        emit!(SettlementInitiated {
            settlement: ctx.accounts.settlement.key(),
            pool: pool.key(),
            corridor: pool.corridor,
            sender: settlement.sender_institution,
            receiver: receiver_institution,
            amount,
            fee,
            net_amount,
            memo,
        });
        Ok(())
    }

    /// Complete settlement after compliance checks pass
    pub fn complete_settlement(ctx: Context<CompleteSettlement>) -> Result<()> {
        let settlement = &ctx.accounts.settlement;
        require!(
            settlement.status == SettlementStatus::Pending,
            PoolError::InvalidSettlementStatus
        );

        let corridor = ctx.accounts.pool.corridor;
        let pool_bump = ctx.accounts.pool.bump;

        // Transfer net amount from vault to receiver
        let seeds = &[b"pool", corridor.as_ref(), &[pool_bump]];
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token_2022::TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.receiver_token_account.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[seeds],
            ),
            settlement.net_amount,
            ctx.accounts.mint.decimals,
        )?;

        // Update pool accounting
        let pool = &mut ctx.accounts.pool;
        pool.pending_settlements = pool.pending_settlements
            .checked_sub(settlement.amount).unwrap();
        pool.total_settled = pool.total_settled
            .checked_add(settlement.net_amount).unwrap();
        pool.total_deposits = pool.total_deposits
            .checked_sub(settlement.amount).unwrap();

        let settlement = &mut ctx.accounts.settlement;
        settlement.status = SettlementStatus::Completed;
        settlement.completed_at = Some(Clock::get()?.unix_timestamp);

        emit!(SettlementCompleted {
            settlement: ctx.accounts.settlement.key(),
            corridor,
            amount: settlement.net_amount,
            completed_at: settlement.completed_at.unwrap(),
        });
        Ok(())
    }

    /// Fail/reject a settlement — releases locked funds back to pool
    pub fn fail_settlement(
        ctx: Context<FailSettlement>,
        reason: String,
    ) -> Result<()> {
        let settlement = &ctx.accounts.settlement;
        require!(
            settlement.status == SettlementStatus::Pending,
            PoolError::InvalidSettlementStatus
        );

        let pool = &mut ctx.accounts.pool;
        pool.pending_settlements = pool.pending_settlements
            .checked_sub(settlement.amount).unwrap();

        let settlement = &mut ctx.accounts.settlement;
        settlement.status = SettlementStatus::Failed;

        emit!(SettlementFailed {
            settlement: ctx.accounts.settlement.key(),
            reason,
        });
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(corridor: [u8; 5])]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = Pool::LEN,
        seeds = [b"pool", corridor.as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = pool,
        seeds = [b"vault", corridor.as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [b"pool", pool.corridor.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [b"vault", pool.corridor.as_ref()], bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub institution_token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub institution: Signer<'info>,
    #[account(
        init_if_needed,
        payer = institution,
        space = InstitutionPosition::LEN,
        seeds = [b"position", pool.key().as_ref(), institution.key().as_ref()],
        bump
    )]
    pub institution_position: Account<'info, InstitutionPosition>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
#[instruction(amount: u64, receiver_institution: Pubkey, memo: String, idempotency_key: [u8; 32])]
pub struct InitiateSettlement<'info> {
    #[account(mut, seeds = [b"pool", pool.corridor.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = sender_institution,
        space = Settlement::LEN,
        seeds = [b"settlement", idempotency_key.as_ref()],
        bump
    )]
    pub settlement: Account<'info, Settlement>,
    pub sender_institution: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompleteSettlement<'info> {
    #[account(mut, seeds = [b"pool", pool.corridor.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [b"settlement", settlement.idempotency_key.as_ref()], bump = settlement.bump)]
    pub settlement: Account<'info, Settlement>,
    #[account(mut, seeds = [b"vault", pool.corridor.as_ref()], bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub receiver_token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct FailSettlement<'info> {
    #[account(mut, seeds = [b"pool", pool.corridor.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [b"settlement", settlement.idempotency_key.as_ref()], bump = settlement.bump)]
    pub settlement: Account<'info, Settlement>,
    pub authority: Signer<'info>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct Pool {
    pub corridor: [u8; 5],
    pub authority: Pubkey,
    pub vault: Pubkey,
    pub total_deposits: u64,
    pub total_settled: u64,
    pub pending_settlements: u64,
    pub min_liquidity: u64,
    pub transfer_fee_bps: u16,
    pub is_active: bool,
    pub bump: u8,
}
impl Pool {
    pub const LEN: usize = 8 + 5 + 32 + 32 + 8 + 8 + 8 + 8 + 2 + 1 + 1;
}

#[account]
pub struct InstitutionPosition {
    pub institution: Pubkey,
    pub pool: Pubkey,
    pub deposited: u64,
    pub last_deposit_at: i64,
}
impl InstitutionPosition {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8;
}

#[account]
pub struct Settlement {
    pub pool: Pubkey,
    pub corridor: [u8; 5],
    pub sender_institution: Pubkey,
    pub receiver_institution: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub net_amount: u64,
    pub memo: String,        // Travel Rule reference
    pub idempotency_key: [u8; 32],
    pub status: SettlementStatus,
    pub initiated_at: i64,
    pub completed_at: Option<i64>,
    pub bump: u8,
}
impl Settlement {
    pub const LEN: usize = 8 + 32 + 5 + 32 + 32 + 8 + 8 + 8 + 4 + 512 + 32 + 1 + 8 + 9 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum SettlementStatus { Pending, Completed, Failed }

// ─── Events ──────────────────────────────────────────────────────────────────

#[event] pub struct PoolInitialized { pub corridor: [u8; 5], pub authority: Pubkey, pub transfer_fee_bps: u16 }
#[event] pub struct DepositMade { pub pool: Pubkey, pub corridor: [u8; 5], pub institution: Pubkey, pub amount: u64, pub new_pool_total: u64 }
#[event] pub struct SettlementInitiated { pub settlement: Pubkey, pub pool: Pubkey, pub corridor: [u8; 5], pub sender: Pubkey, pub receiver: Pubkey, pub amount: u64, pub fee: u64, pub net_amount: u64, pub memo: String }
#[event] pub struct SettlementCompleted { pub settlement: Pubkey, pub corridor: [u8; 5], pub amount: u64, pub completed_at: i64 }
#[event] pub struct SettlementFailed { pub settlement: Pubkey, pub reason: String }

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum PoolError {
    #[msg("Pool is currently inactive")] PoolInactive,
    #[msg("Amount must be greater than zero")] ZeroAmount,
    #[msg("Insufficient pool liquidity")] InsufficientLiquidity,
    #[msg("Transfer would drop pool below minimum liquidity")] BelowMinLiquidity,
    #[msg("Memo must be 8–512 characters (Travel Rule reference required)")] InvalidMemo,
    #[msg("Settlement is not in Pending status")] InvalidSettlementStatus,
    #[msg("Fee cannot exceed 5%")] FeeTooHigh,
}
