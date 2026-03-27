# IroFi — Security Audit Checklist

## On-Chain Programs

### stablecoin-token
- [x] Default Account State = Frozen — new accounts cannot transact without KYC
- [x] KYC record PDA seeds prevent spoofing (`["kyc_record", institution_pubkey]`)
- [x] `has_one = authority` constraint on all admin instructions
- [x] Checked arithmetic — `checked_add`, `checked_sub` throughout
- [x] No unchecked `UncheckedAccount` used for fund-holding accounts
- [ ] TODO: Add `close = authority` to KYC records to prevent state bloat

### treasury-pool
- [x] Idempotency key as PDA seed prevents double-spend at account-init level
- [x] `min_liquidity` enforcement prevents pool drain
- [x] Fee capped at 500 bps (5%) — `require!(fee_bps <= 500)`
- [x] Pending settlements tracked atomically — no race conditions possible
- [x] Memo length enforced (8–512 chars) — prevents empty Travel Rule references
- [ ] TODO: Add emergency pause mechanism at pool level (admin CPI)

### transfer-hook
- [x] `#[interface(spl_transfer_hook_interface::execute)]` — correct discriminator
- [x] Both sender AND receiver checked in single atomic instruction
- [x] FATF grey-list check applies stricter risk threshold
- [x] Sanctions flag is a hard block — no bypass path
- [x] KYC expiry checked at transfer time — not just at registration
- [x] ExtraAccountMetaList PDA registered correctly
- [ ] TODO: Confidential Transfers + Transfer Hook incompatibility — awaiting upstream fix

### routing-logic
- [x] `AlreadyApproved` check prevents double-counting in multisig flow
- [x] Max signers capped at 5 — `require!(required_signers <= 5)`
- [x] Route inactive check before intent creation
- [x] Amount bounds enforced per corridor
- [ ] TODO: Add timeout for AwaitingMultisig intents (auto-reject after 24h)

## API Layer

- [x] JWT expiry: 24h
- [x] Rate limiting: 100 req/min per institution
- [x] Wallet signature auth — nonce-based, one-time challenge
- [x] Webhook HMAC-SHA256 — constant-time comparison
- [x] Input validation via Fastify JSON Schema on all endpoints
- [x] Error messages sanitized in production (no stack traces)
- [x] Database queries use parameterized statements (Drizzle ORM)
- [ ] TODO: Add API key rotation mechanism
- [ ] TODO: Add IP allowlist option per institution

## Compliance

- [x] KYC validity period reduced for FATF grey-listed jurisdictions (180d vs 365d)
- [x] Sanctions check runs before any on-chain instruction
- [x] SAR/CTR determination integrated into AML engine
- [x] Travel Rule sunrise problem handled — no silent bypass for large amounts
- [x] TRISA envelope HMAC verified before decryption
- [ ] TODO: Integrate ComplyAdvantage for entity name matching (currently stubbed)
- [ ] TODO: Add periodic KYC re-verification job

## Running cargo audit

```bash
cd apps/programs
cargo audit

# Expected output:
# Crate:       irofi-programs
# Version:     0.1.0
# Warning:     0 vulnerabilities found
```

## Running clippy

```bash
cd apps/programs
cargo clippy -- -D warnings
```
