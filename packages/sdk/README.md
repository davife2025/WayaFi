# @irofi/sdk

Official TypeScript SDK for IroFi — institutional cross-border stablecoin treasury rails for Africa.

## Install

```bash
npm install @irofi/sdk
# or
pnpm add @irofi/sdk
```

## Quick Start

```typescript
import { IroFiClient } from "@irofi/sdk";

const client = new IroFiClient({
  apiUrl: "https://api.irofi.io/v1",
  apiKey: process.env.IROFI_API_KEY!,
});

// Initiate a $50,000 USDC transfer Lagos → Nairobi
const transfer = await client.initiateTreasuryTransfer({
  sender_institution_id: "inst_lagos_001",
  receiver_institution_id: "inst_nairobi_001",
  amount_usdc: 50_000,
  corridor: "NG_KE",
  memo: "Invoice #INV-2026-001 — goods settlement",
  idempotency_key: "unique-key-abc123",
});

console.log(transfer.transfer_id);  // txfr_1234567890_abc12345
console.log(transfer.status);       // "initiated"
// Completes in ~8 seconds
```

## Full Pipeline

Every transfer runs automatically:
1. **KYT screen** (Elliptic) — sender + receiver wallets
2. **Sanctions check** (OFAC / UN / EU / UK)
3. **AML assessment** — risk scoring, SAR/CTR determination
4. **Travel Rule** (TRISA) — IVMS101 data exchange with beneficiary VASP
5. **On-chain settlement** (Solana) — treasury pool program
6. **Webhook delivery** — `transfer.completed` event

## Corridor Support

| Corridor | Code |
|---|---|
| Nigeria → Kenya | `NG_KE` |
| Nigeria → South Africa | `NG_ZA` |
| Nigeria → Ghana | `NG_GH` |
| Kenya → South Africa | `KE_ZA` |
| Kenya → Ghana | `KE_GH` |

## Webhooks

```typescript
// Register a webhook
const webhook = await client.registerWebhook({
  url: "https://your-server.com/webhooks/irofi",
  events: ["transfer.completed", "transfer.failed", "compliance.hold"],
});
console.log(webhook.secret); // store this — shown only once

// Verify incoming webhook (in your server)
import { verifyWebhookSignature } from "@irofi/sdk";

app.post("/webhooks/irofi", (req, res) => {
  const valid = verifyWebhookSignature(
    JSON.stringify(req.body),
    req.headers["x-irofi-signature"],
    process.env.IROFI_WEBHOOK_SECRET!
  );
  if (!valid) return res.status(401).send();
  const { event, data } = req.body;
  // handle event...
});
```

## FX Rate-Triggered Transfers

```typescript
// Check if rate meets your threshold before sending
const evaluation = await client.evaluateRateThreshold({
  corridor: "NG_KE",
  amount_usdc: 50_000,
  target_rate: 130.5,   // min KES per NGN implied rate
  tolerance_bps: 50,    // allow 0.5% below target
});

if (evaluation.should_execute) {
  await client.initiateTreasuryTransfer({ ... });
}
```

## Error Handling

```typescript
import { IroFiClient, IroFiError } from "@irofi/sdk";

try {
  await client.initiateTreasuryTransfer({ ... });
} catch (err) {
  if (err instanceof IroFiError) {
    console.log(err.code);       // "COMPLIANCE_REJECTED" | "TIMEOUT" | etc.
    console.log(err.statusCode); // 422 | 408 | etc.
    console.log(err.message);    // human-readable description
  }
}
```
