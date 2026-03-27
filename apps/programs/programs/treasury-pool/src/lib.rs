use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

/// treasury_pool — stub scaffold, fully implemented in Session 2
#[program]
pub mod treasury_pool {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("treasury-pool — Session 2 implementation pending");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
