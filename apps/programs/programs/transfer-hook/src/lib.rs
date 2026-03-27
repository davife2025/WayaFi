use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

/// transfer_hook — stub scaffold, fully implemented in Session 2
#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("transfer-hook — Session 2 implementation pending");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
