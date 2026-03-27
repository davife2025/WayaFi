# IroFi — Session 3: Compliance Layer (KYC / KYT / AML)

## What Was Built

The off-chain compliance engine that feeds the on-chain programs.

### Modules

| Module | File | Provider | Purpose |
|---|---|---|---|
| KYC | `packages/compliance/src/kyc.ts` | Smile ID | Africa-specific identity verification |
| KYT | `packages/compliance/src/kyt.ts` | Elliptic | Real-time transaction screening |
| Sanctions | `packages/compliance/src/sanctions.ts` | Elliptic + FATF | OFAC/UN/EU/UK sanctions checks |
| AML Engine | `packages/compliance/src/aml.ts` | Internal | Risk scoring + SAR/CTR determination |
| API Routes | `apps/api/src/compliance/routes.ts` | Fastify | HTTP endpoints for all compliance ops |

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/compliance/kyc` | Submit institution for KYC |
| POST | `/compliance/kyt` | Screen a pending transfer |
| POST | `/compliance/sanctions` | Check wallet against sanctions lists |
| POST | `/compliance/aml/assess` | Full AML risk assessment |

### Required Environment Variables

```bash
SMILE_ID_API_KEY=          # From smileidentity.com
SMILE_ID_PARTNER_ID=       # From smileidentity.com dashboard
ELLIPTIC_API_KEY=          # From elliptic.co
ELLIPTIC_API_SECRET=       # From elliptic.co
```

### FATF Grey-List Handling

Jurisdictions: NG (Nigeria), AO (Angola), CM (Cameroon), CD (DRC)

- KYC validity period reduced to 180 days (vs 365 for standard)
- KYT risk threshold tightened — max risk score 40 (vs 60 standard)
- Transfer Hook enforces grey-list rules atomically on-chain
- AML engine adds +15 to risk score per grey-listed party

### AML Decision Matrix

| Risk Score | KYT Result | Decision | Action |
|---|---|---|---|
| 0–39 | Approved | ✅ Approve | Process transfer |
| 40–74 | Approved | ⏸ Hold | Manual review queue |
| 75–100 | Any | ❌ Reject | Block + SAR if ≥70 |
| Any | Rejected | ❌ Reject | Block immediately |
| Sanctions match | Any | ❌ Reject | Block + SAR mandatory |
