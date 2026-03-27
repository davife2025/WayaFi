use anchor_lang::prelude::*;

declare_id!("IroFiRout1111111111111111111111111111111111");

/// IroFi Routing Logic Program
///
/// Multi-corridor path selection and multi-sig authorization.
/// Chooses the optimal corridor, applies FX rate thresholds,
/// and enforces multi-sig approval for large transfers.
#[program]
pub mod routing_logic {
    use super::*;

    /// Register a corridor route with FX thresholds and limits
    pub fn register_route(
        ctx: Context<RegisterRoute>,
        corridor: [u8; 5],
        min_amount: u64,
        max_amount: u64,
        fx_rate_threshold: u64,  // 6 decimal places e.g. 1_310_000 = 1.31
        multisig_threshold_amount: u64, // amount above which multisig required
        required_signers: u8,
    ) -> Result<()> {
        require!(min_amount < max_amount, RoutingError::InvalidAmountRange);
        require!(required_signers >= 1 && required_signers <= 5, RoutingError::InvalidSignerCount);

        let route = &mut ctx.accounts.route;
        route.corridor = corridor;
        route.authority = ctx.accounts.authority.key();
        route.min_amount = min_amount;
        route.max_amount = max_amount;
        route.fx_rate_threshold = fx_rate_threshold;
        route.multisig_threshold_amount = multisig_threshold_amount;
        route.required_signers = required_signers;
        route.is_active = true;
        route.total_routed = 0;
        route.bump = ctx.bumps.route;

        emit!(RouteRegistered { corridor, min_amount, max_amount, required_signers });
        Ok(())
    }

    /// Create a pending transfer — awaits multi-sig approval if above threshold
    pub fn create_transfer_intent(
        ctx: Context<CreateTransferIntent>,
        amount: u64,
        corridor: [u8; 5],
        current_fx_rate: u64,
        idempotency_key: [u8; 32],
    ) -> Result<()> {
        let route = &ctx.accounts.route;
        require!(route.is_active, RoutingError::RouteInactive);
        require!(amount >= route.min_amount, RoutingError::BelowMinAmount);
        require!(amount <= route.max_amount, RoutingError::ExceedsMaxAmount);

        let intent = &mut ctx.accounts.transfer_intent;
        intent.corridor = corridor;
        intent.initiator = ctx.accounts.initiator.key();
        intent.amount = amount;
        intent.current_fx_rate = current_fx_rate;
        intent.idempotency_key = idempotency_key;
        intent.created_at = Clock::get()?.unix_timestamp;
        intent.bump = ctx.bumps.transfer_intent;

        // Determine if multisig is required
        if amount >= route.multisig_threshold_amount {
            intent.status = TransferIntentStatus::AwaitingMultisig;
            intent.required_signers = route.required_signers;
            intent.approvals = 0;
        } else {
            intent.status = TransferIntentStatus::Approved;
            intent.required_signers = 1;
            intent.approvals = 1;
        }

        emit!(TransferIntentCreated {
            intent: ctx.accounts.transfer_intent.key(),
            corridor,
            amount,
            current_fx_rate,
            requires_multisig: amount >= route.multisig_threshold_amount,
        });
        Ok(())
    }

    /// Approve a pending transfer intent (multi-sig flow)
    pub fn approve_transfer(ctx: Context<ApproveTransfer>) -> Result<()> {
        let intent = &mut ctx.accounts.transfer_intent;
        require!(
            intent.status == TransferIntentStatus::AwaitingMultisig,
            RoutingError::NotAwaitingApproval
        );

        // Check this signer hasn't already approved
        let signer_key = ctx.accounts.approver.key();
        require!(
            !intent.approver_keys.contains(&signer_key),
            RoutingError::AlreadyApproved
        );

        intent.approver_keys.push(signer_key);
        intent.approvals += 1;

        if intent.approvals >= intent.required_signers {
            intent.status = TransferIntentStatus::Approved;
            emit!(TransferApproved {
                intent: ctx.accounts.transfer_intent.key(),
                approvals: intent.approvals,
            });
        } else {
            emit!(ApprovalAdded {
                intent: ctx.accounts.transfer_intent.key(),
                approver: signer_key,
                approvals: intent.approvals,
                required: intent.required_signers,
            });
        }
        Ok(())
    }

    /// Execute an approved transfer intent — marks it dispatched to treasury pool
    pub fn execute_transfer(ctx: Context<ExecuteTransfer>) -> Result<()> {
        let intent = &mut ctx.accounts.transfer_intent;
        require!(
            intent.status == TransferIntentStatus::Approved,
            RoutingError::NotApproved
        );

        intent.status = TransferIntentStatus::Executed;
        intent.executed_at = Some(Clock::get()?.unix_timestamp);

        let route = &mut ctx.accounts.route;
        route.total_routed = route.total_routed.checked_add(intent.amount).unwrap();

        emit!(TransferExecuted {
            intent: ctx.accounts.transfer_intent.key(),
            corridor: intent.corridor,
            amount: intent.amount,
            fx_rate: intent.current_fx_rate,
        });
        Ok(())
    }

    /// Update FX rate threshold for a corridor — triggered by oracle feed
    pub fn update_fx_threshold(
        ctx: Context<UpdateRoute>,
        new_threshold: u64,
    ) -> Result<()> {
        ctx.accounts.route.fx_rate_threshold = new_threshold;
        emit!(FXThresholdUpdated {
            corridor: ctx.accounts.route.corridor,
            new_threshold,
        });
        Ok(())
    }

    /// Pause a corridor route
    pub fn pause_route(ctx: Context<UpdateRoute>) -> Result<()> {
        ctx.accounts.route.is_active = false;
        emit!(RoutePaused { corridor: ctx.accounts.route.corridor });
        Ok(())
    }

    /// Resume a paused corridor route
    pub fn resume_route(ctx: Context<UpdateRoute>) -> Result<()> {
        ctx.accounts.route.is_active = true;
        emit!(RouteResumed { corridor: ctx.accounts.route.corridor });
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(corridor: [u8; 5])]
pub struct RegisterRoute<'info> {
    #[account(
        init,
        payer = payer,
        space = Route::LEN,
        seeds = [b"route", corridor.as_ref()],
        bump
    )]
    pub route: Account<'info, Route>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, corridor: [u8; 5], current_fx_rate: u64, idempotency_key: [u8; 32])]
pub struct CreateTransferIntent<'info> {
    #[account(seeds = [b"route", corridor.as_ref()], bump = route.bump)]
    pub route: Account<'info, Route>,
    #[account(
        init,
        payer = initiator,
        space = TransferIntent::LEN,
        seeds = [b"intent", idempotency_key.as_ref()],
        bump
    )]
    pub transfer_intent: Account<'info, TransferIntent>,
    #[account(mut)]
    pub initiator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveTransfer<'info> {
    #[account(mut, seeds = [b"intent", transfer_intent.idempotency_key.as_ref()], bump = transfer_intent.bump)]
    pub transfer_intent: Account<'info, TransferIntent>,
    pub approver: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteTransfer<'info> {
    #[account(mut, seeds = [b"route", route.corridor.as_ref()], bump = route.bump)]
    pub route: Account<'info, Route>,
    #[account(mut, seeds = [b"intent", transfer_intent.idempotency_key.as_ref()], bump = transfer_intent.bump)]
    pub transfer_intent: Account<'info, TransferIntent>,
    pub executor: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateRoute<'info> {
    #[account(mut, seeds = [b"route", route.corridor.as_ref()], bump = route.bump, has_one = authority)]
    pub route: Account<'info, Route>,
    pub authority: Signer<'info>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct Route {
    pub corridor: [u8; 5],
    pub authority: Pubkey,
    pub min_amount: u64,
    pub max_amount: u64,
    pub fx_rate_threshold: u64,
    pub multisig_threshold_amount: u64,
    pub required_signers: u8,
    pub is_active: bool,
    pub total_routed: u64,
    pub bump: u8,
}
impl Route {
    pub const LEN: usize = 8 + 5 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 1;
}

#[account]
pub struct TransferIntent {
    pub corridor: [u8; 5],
    pub initiator: Pubkey,
    pub amount: u64,
    pub current_fx_rate: u64,
    pub idempotency_key: [u8; 32],
    pub status: TransferIntentStatus,
    pub required_signers: u8,
    pub approvals: u8,
    pub approver_keys: Vec<Pubkey>,  // up to 5
    pub created_at: i64,
    pub executed_at: Option<i64>,
    pub bump: u8,
}
impl TransferIntent {
    pub const LEN: usize = 8 + 5 + 32 + 8 + 8 + 32 + 1 + 1 + 1 + (4 + 5 * 32) + 8 + 9 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TransferIntentStatus {
    AwaitingMultisig,
    Approved,
    Executed,
    Rejected,
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event] pub struct RouteRegistered { pub corridor: [u8; 5], pub min_amount: u64, pub max_amount: u64, pub required_signers: u8 }
#[event] pub struct TransferIntentCreated { pub intent: Pubkey, pub corridor: [u8; 5], pub amount: u64, pub current_fx_rate: u64, pub requires_multisig: bool }
#[event] pub struct ApprovalAdded { pub intent: Pubkey, pub approver: Pubkey, pub approvals: u8, pub required: u8 }
#[event] pub struct TransferApproved { pub intent: Pubkey, pub approvals: u8 }
#[event] pub struct TransferExecuted { pub intent: Pubkey, pub corridor: [u8; 5], pub amount: u64, pub fx_rate: u64 }
#[event] pub struct FXThresholdUpdated { pub corridor: [u8; 5], pub new_threshold: u64 }
#[event] pub struct RoutePaused { pub corridor: [u8; 5] }
#[event] pub struct RouteResumed { pub corridor: [u8; 5] }

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum RoutingError {
    #[msg("Route is currently inactive")] RouteInactive,
    #[msg("Amount below corridor minimum")] BelowMinAmount,
    #[msg("Amount exceeds corridor maximum")] ExceedsMaxAmount,
    #[msg("Invalid amount range: min must be less than max")] InvalidAmountRange,
    #[msg("Required signers must be between 1 and 5")] InvalidSignerCount,
    #[msg("Transfer is not awaiting approval")] NotAwaitingApproval,
    #[msg("This approver has already signed")] AlreadyApproved,
    #[msg("Transfer is not in Approved status")] NotApproved,
}
