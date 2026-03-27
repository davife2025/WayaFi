# IroFi — Session 9: TypeScript SDK

## What Was Built

Full production SDK for institutions integrating IroFi.

### Files

| File | Purpose |
|---|---|
| `packages/sdk/src/client.ts` | IroFiClient — all API methods, typed |
| `packages/sdk/src/webhook.ts` | verifyWebhookSignature, parseWebhook |
| `packages/sdk/README.md` | Full integration guide with examples |

### Methods

| Method | Description |
|---|---|
| `initiateTreasuryTransfer()` | Start a cross-border transfer |
| `getTransfer()` | Get transfer + pipeline audit trail |
| `listTransfers()` | List transfers with filters |
| `checkComplianceStatus()` | Institution KYC/AML/sanctions status |
| `submitKYC()` | Submit KYC documents |
| `getCorridorLiquidity()` | Single corridor stats |
| `getAllCorridors()` | All corridor stats |
| `getOracleRate()` | Live FX rate (Pyth + SIX) |
| `evaluateRateThreshold()` | Rate-triggered transfer check |
| `getRampQuote()` | Best fiat/USDC ramp quote |
| `registerWebhook()` | Subscribe to events |
| `removeWebhook()` | Unsubscribe |
| `lookupVASP()` | TRISA directory lookup |

### Building

```bash
cd packages/sdk
pnpm build
# Output: dist/index.js, dist/index.cjs, dist/index.d.ts
```
