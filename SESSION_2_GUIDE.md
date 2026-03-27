# IroFi — Session 2: Solana Programs (On-Chain Core)

## What Was Built

Four production Anchor programs — the beating heart of IroFi.

### Programs

| Program | Program ID (devnet) | Purpose |
|---|---|---|
| `stablecoin-token` | IroFiTokn... | Token-2022 mint with Transfer Hook, Default Account State, Required Memo |
| `treasury-pool` | IroFiPool... | USDC liquidity pool — nostro/vostro replacement |
| `transfer-hook` | IroFiHook... | Atomic KYT gatekeeper on every transfer |
| `routing-logic` | IroFiRout... | Multi-corridor routing + multi-sig authorization |

### Key Architecture Decisions

**Why `#[interface(spl_transfer_hook_interface::execute)]`?**
This attribute is MANDATORY on the execute function. Without it, Anchor doesn't override
the instruction discriminator correctly and Token-2022's CPI call silently fails to find
the Transfer Hook instruction. Every transfer would fail with no clear error.

**Why Default Account State = Frozen?**
New institution accounts start locked. The institution must pass KYC before their account
is unfrozen. This is a hard on-chain gate — no KYC = no transfers, period.

**Why idempotency keys as PDA seeds for settlements?**
This makes every settlement idempotent by design. A duplicate transaction attempt with
the same idempotency key will fail at the PDA init level, not at business logic — preventing
double-spends without any additional state checks.

## How to Build

```bash
cd apps/programs
anchor build
```

## How to Deploy to Devnet

```bash
# First time — generate program keypairs
solana-keygen new -o target/deploy/stablecoin_token-keypair.json
solana-keygen new -o target/deploy/treasury_pool-keypair.json
solana-keygen new -o target/deploy/transfer_hook-keypair.json
solana-keygen new -o target/deploy/routing_logic-keypair.json

# Update Anchor.toml with generated program IDs
# Then:
anchor deploy --provider.cluster devnet
```

## How to Run Tests

```bash
cd apps/programs
anchor test
```

## Corridors Supported

| Corridor | Code | Notes |
|---|---|---|
| Nigeria → Kenya | NG_KE | Both FATF grey-listed — enhanced DD |
| Nigeria → South Africa | NG_ZA | Nigeria grey-listed |
| Nigeria → Ghana | NG_GH | Nigeria grey-listed |
| Kenya → South Africa | KE_ZA | Standard corridor |
| Kenya → Ghana | KE_GH | Standard corridor |
