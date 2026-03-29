# WayaFi

**Institutional cross-border stablecoin treasury rails for Africa, built on Solana.**

WayaFi is a compliance-first, production-grade USDC settlement infrastructure enabling African banks, fintechs, and corporate treasuries to move money across borders in seconds — without correspondent banking, without prefunded nostro accounts, and without routing through New York or London.

Built for the [StableHacks 2026](https://colosseum.org) hackathon — **Cross-Border Stablecoin Treasury** track.

---

<div align="center">

![Solana](https://img.shields.io/badge/Solana-Token--2022-9945FF?style=flat-square&logo=solana)
![License](https://img.shields.io/badge/license-MIT-0EE8B1?style=flat-square)
![Build](https://img.shields.io/badge/build-passing-0EE8B1?style=flat-square)
![pnpm](https://img.shields.io/badge/pnpm-monorepo-F59E0B?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square)

**[Live Demo](https://wayafi.vercel.app)** · **[API Docs](https://wayafi.onrender.com/v1/docs)** · **[Architecture](#architecture)**

</div>

---

## The Problem

African cross-border payments are broken at the infrastructure layer:

| Problem | Reality |
|---|---|
| Cost | 6–8% average fee on every transfer |
| Speed | 3–5 business days via SWIFT |
| Route | Ghana → Zambia still routes through New York |
| Compliance | Manual, siloed KYC/AML across 54 jurisdictions |
| Travel Rule | No African VASP has fully implemented TRISA |
| Liquidity | $17B lost annually to FX arbitrage in Nigeria alone |

WayaFi replaces the entire correspondent banking stack with Solana-native settlement at **< 400ms finality** and **0.15% fees**.

---

## What We Built

A full-stack institutional treasury platform across 10 sessions:

```
WayaFi
├── On-chain Programs (Anchor / Token-2022)
│   ├── Transfer Hook — atomic KYC/KYT compliance on every transfer
│   ├── Treasury Pool — multi-corridor USDC liquidity management
│   ├── KYC Whitelist — permissioned wallet registry
│   └── Routing Program — FX-threshold-triggered execution
│
├── Compliance Engine
│   ├── KYC — Smile ID integration (Africa-native document verification)
│   ├── KYT — Elliptic real-time transaction screening
│   ├── AML — corridor-specific risk scoring (FATF grey list aware)
│   └── Sanctions — OFAC · UN · EU · HMT screening
│
├── Travel Rule Module
│   ├── TRISA v3 protocol — VASP-to-VASP encrypted envelope exchange
│   ├── IVMS 101 compliant originator/beneficiary data
│   ├── ISO 20022 aligned messaging
│   └── Sunrise problem handling (non-compliant VASP degradation)
│
├── Oracle Layer
│   ├── Pyth Hermes — real-time NGN/KES/GHS/ZAR/UGX/TZS rates
│   ├── SIX Financial — hackathon partner FX data + precious metals
│   ├── Doppler (21 CU) — on-chain FX rate publication
│   └── Composite routing — Pyth 60% / SIX 40% cross-validation
│
├── On/Off Ramp Layer
│   ├── Yellow Card — Nigeria, Kenya, Ghana, Uganda, Tanzania, South Africa
│   ├── Bitnob — West Africa specialist
│   ├── Muda — Kenya/Uganda M-Pesa integration
│   └── Circuit breaker + health-check failover per provider
│
├── Backend API (Fastify + Drizzle + PostgreSQL)
│   ├── JWT + Solana wallet signature auth
│   ├── Transfer lifecycle orchestration
│   ├── Compliance event indexer
│   └── Webhook delivery system
│
├── Institutional Dashboard (Next.js 14)
│   ├── Bloomberg-terminal design system
│   ├── Live corridor rates (Pyth + SIX composite)
│   ├── 5-step compliant transfer flow
│   ├── Compliance centre — KYC · AML · Sanctions · Travel Rule tabs
│   └── Audit trail — immutable on-chain anchored log
│
└── TypeScript SDK
    ├── initiateTreasuryTransfer()
    ├── registerRateTrigger() — deferred FX-condition execution
    ├── checkComplianceStatus()
    └── verifyWebhookSignature()
```

---

## Active Corridors

| Corridor | From | To | FX Pair | FATF Status |
|---|---|---|---|---|
| NG→KE | Nigeria 🇳🇬 | Kenya 🇰🇪 | NGN/KES | Enhanced DD |
| NG→GH | Nigeria 🇳🇬 | Ghana 🇬🇭 | NGN/GHS | Enhanced DD |
| NG→ZA | Nigeria 🇳🇬 | South Africa 🇿🇦 | NGN/ZAR | Enhanced DD |
| KE→UG | Kenya 🇰🇪 | Uganda 🇺🇬 | KES/UGX | Standard |
| KE→TZ | Kenya 🇰🇪 | Tanzania 🇹🇿 | KES/TZS | Standard |
| GH→ZA | Ghana 🇬🇭 | South Africa 🇿🇦 | GHS/ZAR | Standard |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Institution / Corporate Treasury             │
│                     (First Bank NG, Equity Bank KE...)          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    WayaFi Dashboard   │
                    │    (Next.js / Vercel) │
                    └───────────┬───────────┘
                                │ REST / Webhooks
                    ┌───────────▼───────────┐
                    │    WayaFi API         │
                    │    (Fastify / Render) │
                    └─┬───────────┬────────┘
                      │           │
         ┌────────────▼──┐   ┌────▼───────────────┐
         │  Compliance   │   │   Oracle Layer      │
         │  Engine       │   │   Pyth + SIX +      │
         │  KYC·KYT·AML  │   │   Doppler (on-chain)│
         │  Sanctions     │   └────────────────────┘
         │  TRISA         │
         └────────────┬──┘
                      │ All clear
         ┌────────────▼──────────────────────────────┐
         │              Solana Mainnet                │
         │                                           │
         │  ┌────────────────┐  ┌─────────────────┐  │
         │  │ Transfer Hook  │  │  Treasury Pool  │  │
         │  │ (compliance    │  │  (USDC liquidity│  │
         │  │  gatekeeper)   │  │   management)   │  │
         │  └────────────────┘  └─────────────────┘  │
         │         Token-2022 · Required Memo         │
         └───────────────────┬───────────────────────┘
                             │ Settled (< 400ms)
         ┌───────────────────▼───────────────────────┐
         │           On/Off Ramp Layer                │
         │   Yellow Card · Bitnob · Muda              │
         │   Local fiat delivery in < 5 minutes       │
         └────────────────────────────────────────────┘
```

### Compliance Flow (every transfer)

```
Initiate → KYC Check → Sanctions Screen → AML Score → Travel Rule → Transfer Hook → On-chain → Off-ramp
   │            │              │               │             │             │
   │         Whitelist      OFAC/UN/EU     Risk ≤ 40     TRISA         Atomic
   │          check         HMT check     (grey list      IVMS       KYC enforce
   │                                       corridors)    envelope      on-chain
   └──────────────────── Full audit trail anchored on-chain ─────────────────────┘
```

---

## Monorepo Structure

```
waya/
├── apps/
│   ├── web/                    # Next.js 14 institutional dashboard
│   └── api/                    # Fastify REST API
│
├── packages/
│   ├── types/                  # Shared TypeScript types
│   ├── compliance/             # KYC · KYT · AML · Sanctions engine
│   ├── travel-rule/            # TRISA protocol + IVMS 101
│   ├── oracle/                 # Pyth + SIX + FX router + rate triggers
│   ├── ramp/                   # Yellow Card · Bitnob · Muda adapters
│   ├── sdk/                    # @stablehacks/sdk — public TypeScript SDK
│   └── test-helpers/           # E2E tests · mock factories · k6 load tests
│
└── programs/ (Anchor)
    ├── transfer-hook/          # Token-2022 compliance gatekeeper
    ├── treasury-pool/          # Multi-corridor USDC liquidity
    ├── kyc-whitelist/          # Permissioned wallet registry
    └── routing-logic/          # FX-threshold transfer routing
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solana Mainnet · Token-2022 · Anchor v0.31 |
| Smart Contracts | Rust · Anchor · Transfer Hook Interface |
| Oracle | Pyth Hermes · SIX Financial API · Doppler (21 CU) |
| Compliance | Elliptic (KYT) · Smile ID (KYC) · Custom AML engine |
| Travel Rule | TRISA v3 · IVMS 101 · X.509 PKI · ISO 20022 |
| API | Node.js · Fastify · Drizzle ORM · PostgreSQL |
| Frontend | Next.js 14 · Tailwind CSS · TanStack Query |
| Wallet | Solana Wallet Adapter · Phantom · Solflare |
| On/Off Ramp | Yellow Card · Bitnob · Muda |
| Monorepo | pnpm workspaces · Turborepo |
| Deployment | Vercel (web) · Render (API) · PostgreSQL |

---

## Getting Started

### Prerequisites

```bash
node >= 20
pnpm >= 9
```

### Install

```bash
git clone https://github.com/davife2025/WayaFi.git
cd WayaFi
pnpm install
```

### Environment Variables

Create `apps/api/.env`:

```bash
# Generate a secure secret:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

JWT_SECRET=your_generated_secret_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wayafi_dev
SOLANA_RPC_URL=https://api.devnet.solana.com
NODE_ENV=development
PORT=4000
```

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/v1
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
```

### Run locally

```bash
# Run everything (web + API) in parallel
pnpm dev

# Web only: http://localhost:3000
pnpm --filter @irofi/web dev

# API only: http://localhost:4000
pnpm --filter @irofi/api dev
```

### Build

```bash
pnpm build
```

---

## SDK Usage

```typescript
import { IrofiClient } from "@stablehacks/sdk";

const client = new IrofiClient({
  apiKey: "sk_live_...",
  environment: "production",
});

// Initiate a $50,000 Lagos → Nairobi transfer
const transfer = await client.treasury.initiate({
  corridorId: "NG-KE",
  amountUsdc: 50_000,
  senderWallet: "7xKp4mRq...",
  receiverWallet: "9aLm2kNp...",
  memo: "INV-2026-0091",
});

// Wait for Solana settlement (< 10s end-to-end)
const settled = await client.treasury.waitForSettlement(transfer.id);
console.log(settled.txSignature); // On-chain proof

// Register a rate-triggered deferred transfer
await client.treasury.registerRateTrigger({
  corridorId: "NG-KE",
  targetRate: 0.75,
  direction: "BELOW",
  amountUsdc: 100_000,
  expiresInSeconds: 3600,
  webhookUrl: "https://your-erp.company.com/wayafi/trigger",
});
```

Full SDK documentation: [`packages/sdk/INTEGRATION.md`](packages/sdk/INTEGRATION.md)

---

## Demo

### The Story

> First Bank of Nigeria's treasury team settles a **$50,000 trade payment** to Equity Bank Kenya.
>
> **Traditional rails:** 3 business days · $3,000 in fees · Manual compliance chase via SWIFT
>
> **WayaFi:** 9 seconds · $75 (0.15%) · Automated KYC/KYT/AML/Travel Rule · On-chain audit trail

### Transfer Lifecycle

```
00:00  Transfer initiated — NG→KE · $50,000 USDC
00:00  KYC verified — both wallets on-chain whitelist ✓
00:01  Sanctions clear — OFAC · UN · EU · HMT ✓
00:01  AML score: 12/100 (LOW) ✓
00:01  TRISA envelope → KCB Kenya VASP → confirmed ✓
00:01  Transfer Hook executes — on-chain atomic compliance check ✓
00:02  Solana transaction confirmed (slot 301,847,291) ✓
00:09  Yellow Card off-ramp notified — KES delivery initiated ✓
```

---

## Compliance Architecture

### Mandatory Requirements (all tracks)

| Requirement | Implementation |
|---|---|
| KYC | Smile ID document + liveness verification → on-chain whitelist write |
| KYT | Elliptic real-time screening via Transfer Hook intercept |
| AML | Corridor-specific risk scoring · FATF grey list enhanced DD |
| Travel Rule | TRISA v3 · IVMS 101 · ISO 20022 · X.509 encrypted envelopes |
| Sanctions | OFAC SDN · UN Security Council · EU Consolidated · HMT |

### FATF Grey List Handling

Nigeria (NG), Angola (AO), and other FATF grey-listed jurisdictions receive automatic enhanced due diligence:
- AML risk threshold tightened to ≤ 40 (standard: ≤ 60)
- KYC validity reduced from 365 days to 180 days
- Beneficial ownership verification mandatory for all counterparties

### Travel Rule — TRISA Protocol

```
Originator VASP (WayaFi NG)
    │
    ├── 1. Lookup beneficiary VASP in TRISA directory
    ├── 2. Encrypt IVMS originator data with VASP X.509 cert
    ├── 3. Send secure envelope via TRISA gRPC
    │
Beneficiary VASP (KCB Kenya / Equity Bank)
    │
    ├── 4. Decrypt envelope
    ├── 5. Verify beneficiary identity
    └── 6. Return confirmation → Transfer Hook executes
```

---

## Why WayaFi Wins

| Dimension | Existing Solutions | WayaFi |
|---|---|---|
| Rail | SWIFT correspondent banking | Solana Token-2022 direct |
| Compliance | Manual, bolted-on | On-chain Transfer Hook — atomic |
| Travel Rule | Off-chain patches / none | TRISA fully integrated |
| FX Intelligence | Static rates | Pyth + SIX composite, rate-triggered |
| Africa coverage | Consumer-focused (Yellow Card, Chipper) | Institutional B2B treasury |
| Solana-native | None at institutional grade | WayaFi |

---

## Performance

| Metric | WayaFi / Solana | SWIFT GPI | Improvement |
|---|---|---|---|
| Settlement | < 400ms | 1–5 business days | **>10,000×** |
| Cost | 0.15% | 6–8% | **40–50×** |
| Uptime | 99.9% · 24/7 | Business hours | **Always on** |
| Travel Rule | Automated (TRISA) | Manual messages | **Automated** |
| Audit trail | On-chain · immutable | CSV exports | **Tamper-proof** |

---

## Hackathon

**Event:** StableHacks 2026
**Track:** Cross-Border Stablecoin Treasury
**Team:** WayaFi

**Mandatory compliance elements:**
- ✅ KYC — Smile ID integration + on-chain whitelist
- ✅ KYT — Elliptic screening via Transfer Hook
- ✅ AML — Corridor risk scoring + FATF grey list handling
- ✅ Travel Rule — Full TRISA v3 implementation

**Data partner:**
- ✅ SIX Financial — FX rates + precious metals integrated in oracle layer

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Web App | Vercel | [wayafi.vercel.app](https://wayafi.vercel.app) |
| API | Render | [wayafi.onrender.com](https://wayafi.onrender.com) |
| Database | Render PostgreSQL | Managed |

---

## License

MIT — see [LICENSE](LICENSE)

---

## Team

Built with ❤️ from Lagos 🇳🇬

*"We are building the institutional rail that African banks, fintechs, and corporate treasuries are waiting for — compliant by design, Solana-native, and Africa-first."*
