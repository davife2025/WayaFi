use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

/// stablecoin_token — stub scaffold, fully implemented in Session 2
#[program]
pub mod stablecoin_token {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("stablecoin-token — Session 2 implementation pending");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
