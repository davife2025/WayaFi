# IroFi — Session 10: Tests, Security & Demo Prep

## What Was Built

### Files

| File | Purpose |
|---|---|
| `apps/programs/tests/irofi-full.test.ts` | 7 Anchor integration tests — full E2E pipeline |
| `apps/api/src/tests/api.test.ts` | API integration tests (Vitest) |
| `scripts/demo.ts` | Hackathon demo script — $50k Lagos→Nairobi |
| `scripts/security-audit.md` | Full security audit checklist |

---

## Running Tests

### Anchor Program Tests (Solana devnet)

```bash
cd apps/programs

# Run on devnet
anchor test --provider.cluster devnet

# Or against local validator
solana-test-validator &
anchor test
```

Expected output:
```
IroFi — Full E2E Transfer: Lagos → Nairobi $50,000 USDC
  ✅ 1. Initializes Transfer Hook config for NG_KE corridor
  ✅ 2. Registers KYC for Lagos Bank and Nairobi Bank
  ✅ 3. Initializes NG_KE treasury pool
  ✅ 4. Creates $50,000 transfer intent — auto-approved
  ✅ 5. Sanctions flag blocks transfer immediately
  ✅ 6. Expired KYC detected
  ✅ 7. Solana slot fetch in <400ms

7 passing (12s)
```

### API Tests (requires running API server)

```bash
# Start API
cd apps/api && pnpm dev

# Run tests
pnpm test
```

---

## Running the Demo

```bash
# Set env vars
export IROFI_API_URL=http://localhost:3001/v1
export IROFI_API_KEY=your-api-key

# Run demo
npx tsx scripts/demo.ts
```

Expected output:
```
════════════════════════════════════════════════════════════
  IroFi — Institutional Cross-Border Treasury Demo
  $50,000 USDC: Lagos → Nairobi
════════════════════════════════════════════════════════════

[09:41:20] 🔍  Checking NG→KE corridor health...
[09:41:21] ✅  Corridor active — liquidity: $2,500,000 USDC
[09:41:21] ⚠️   FATF grey-listed corridor — enhanced due diligence active
[09:41:21] 📊  Fetching live FX rate (Pyth + SIX)...
[09:41:22] ✅  Rate: 1 USDC = 131.40 KES | Source: SIX | Stale: false
[09:41:22] 🚀  Initiating $50,000 USDC transfer...
[09:41:22] ✅  Transfer accepted

[09:41:23] ⏳  Monitoring compliance pipeline...

         ✅ 🔎  KYT Screen (Elliptic) | risk: 2.1 | 340ms
         ✅ 🚫  Sanctions (OFAC/UN/EU/UK) | 120ms
         ✅ 🤖  AML Risk Assessment | risk: 28 | 45ms
         ✅ 📨  Travel Rule (TRISA) | 1200ms
         ✅ ⛓️   On-Chain Settlement (Solana) | 420ms
         ✅ ✅  Settlement Complete | 890ms

────────────────────────────────────────────────────────────

  ✅  TRANSFER COMPLETE

  Amount:      $50,000.00 USDC
  Fee:         $250.00 (0.50%)
  Net:         $49,750.00 USDC received
  Tx:          5xYzAbCd...
  Travel Rule: ACCEPTED
  Time:        8.4s total

  Traditional wire: 3–5 days, 6–8% fee
  IroFi:            8.4s, 0.50% fee

════════════════════════════════════════════════════════════
```

---

## Hackathon Submission Checklist

### Technical
- [x] Session 1 — Monorepo foundation (Turborepo, pnpm, GitHub Actions)
- [x] Session 2 — 4 Anchor programs (Token-2022, treasury pool, transfer hook, routing)
- [x] Session 3 — KYC/KYT/AML compliance layer (Smile ID + Elliptic)
- [x] Session 4 — Travel Rule module (TRISA, IVMS101, sunrise handling)
- [x] Session 5 — Fastify API + PostgreSQL + event indexer
- [x] Session 6 — Oracle/FX (Pyth + SIX data partner)
- [x] Session 7 — On/off ramp adapters (Yellow Card, Bitnob, Muda)
- [x] Session 8 — Institution dashboard (Next.js + Tailwind + wallet auth)
- [x] Session 9 — TypeScript SDK + webhook verification
- [x] Session 10 — Tests, security audit, demo script

### StableHacks Mandatory Requirements
- [x] KYC — Smile ID Africa-specific verification, on-chain whitelist
- [x] KYT — Elliptic real-time transaction screening
- [x] AML — Risk scoring engine with SAR/CTR determination
- [x] Travel Rule — Full TRISA protocol, IVMS101, sunrise handling
- [x] SIX data partner — FX rates and precious metals integrated
- [x] Solana-native — Token-2022, Anchor v0.31, Transfer Hook
- [x] Institutional-grade — multi-sig, audit trail, permissioned access
- [x] Production-ready — PostgreSQL, error handling, rate limiting, webhooks

### Track: Cross-Border Stablecoin Treasury ✅
