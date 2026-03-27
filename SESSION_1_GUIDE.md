# StableHacks 2026 — Session 1: Monorepo Foundation
## Installation & Setup Guide

---

## What This Session Delivers

This scaffold is the foundation for the entire StableHacks monorepo — a Turborepo-powered
workspace that contains all apps and shared packages for the Cross-Border Stablecoin Treasury
platform. Everything built in Sessions 2–10 plugs into this structure.

### Folder Structure

```
stablehacks/
├── apps/
│   ├── api/              ← Fastify backend (Session 5)
│   ├── web/              ← Next.js dashboard (Session 8)
│   └── programs/         ← Solana/Anchor programs (Session 2)
│       └── programs/
│           ├── stablecoin-token/     ← Token-2022 mint program
│           ├── treasury-pool/        ← USDC liquidity pool
│           ├── transfer-hook/        ← KYT compliance hook
│           └── routing-logic/        ← Multi-corridor routing
├── packages/
│   ├── config/           ← Shared TypeScript config
│   ├── types/            ← Shared TypeScript types
│   ├── compliance/       ← KYC/KYT/AML stubs (Session 3)
│   ├── sdk/              ← TypeScript SDK (Session 9)
│   └── test-helpers/     ← Test utilities (Session 10)
├── .github/workflows/    ← GitHub Actions CI
├── .env.example          ← Environment variable template
├── turbo.json            ← Turborepo task config
└── package.json          ← Root workspace config
```

---

## Prerequisites

### Step 1 — Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Follow prompts, choose option 1 (default install)
source ~/.cargo/env
rustup component add rustfmt clippy
rustc --version   # should show 1.75+
```

### Step 2 — Install Solana CLI (v1.18)

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
solana --version   # should show 1.18.x
```

### Step 3 — Install Anchor CLI (v0.31)

> ⚠️ v0.31 is REQUIRED. Earlier versions have a known bug with Token-2022 Transfer Hooks
> where the instruction discriminator override doesn't work correctly, causing every
> token transfer to silently fail.

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.31.0
avm use 0.31.0
anchor --version   # should show anchor-cli 0.31.0
```

### Step 4 — Verify pnpm

```bash
pnpm --version   # needs 9.x
# If below 9, upgrade:
npm install -g pnpm@latest
```

### Step 5 — Generate a Solana wallet for development

```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url devnet
solana airdrop 2   # fund devnet wallet for testing
solana balance
```

---

## Using This Scaffold

### Step 1 — Extract the zip

```bash
unzip stablehacks-session1.zip -d stablehacks
cd stablehacks
```

### Step 2 — Install dependencies

```bash
pnpm install
```

### Step 3 — Set up environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

### Step 4 — Verify the build pipeline works

```bash
pnpm build   # Should succeed (stubs have no compile errors)
```

### Step 5 — Initialize git and push to GitHub

```bash
git init
git add .
git commit -m "chore: session 1 — monorepo foundation"

# Option A — GitHub CLI
gh repo create stablehacks --private --source=. --push

# Option B — Manual
# Create repo at github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/stablehacks.git
git push -u origin main
```

---

## Key Architecture Decisions

### Why Turborepo?
Task orchestration across the monorepo — `pnpm build` runs all package builds in the
correct dependency order. `turbo dev` runs API + web simultaneously with hot reload.

### Why Anchor v0.31 specifically?
The `#[interface(spl_transfer_hook_interface::execute)]` attribute was fixed in v0.30+.
Without it, the Token-2022 program's CPI can't find the Transfer Hook instruction and
transfers silently fail. This burned many teams in earlier hackathons.

### Why @solana/web3.js v2 (not v1)?
The new functional, tree-shakeable API is much smaller in bundle size. We're building
from scratch with no legacy migration burden — use v2 from the start.

### Why Drizzle ORM (not Prisma)?
The compliance layer requires complex custom SQL for audit queries. Drizzle's raw SQL
escape hatch and zero-overhead ORM is the right call. Prisma's generated queries add
unpredictable latency for complex joins at audit time.

### Why Fastify (not Express)?
2–3x throughput advantage at the same hardware, built-in schema validation via JSON
Schema, and first-class TypeScript support with zero-overhead plugins.

---

## What's Stubbed vs Live

| Component | Status | Implemented In |
|---|---|---|
| Monorepo scaffold | ✅ Live | Session 1 (this session) |
| Shared types | ✅ Live | Session 1 |
| CI pipeline | ✅ Live | Session 1 |
| Anchor program stubs | ✅ Scaffold | Session 2 |
| Stablecoin Token program | 🔲 Stub | Session 2 |
| Treasury Pool program | 🔲 Stub | Session 2 |
| Transfer Hook program | 🔲 Stub | Session 2 |
| Routing Logic program | 🔲 Stub | Session 2 |
| KYC/KYT/AML compliance | 🔲 Stub | Session 3 |
| Travel Rule (TRISA) | 🔲 Stub | Session 4 |
| API server (Fastify) | 🔲 Stub | Session 5 |
| Oracle/FX integration | 🔲 Stub | Session 6 |
| On/off ramp adapters | 🔲 Stub | Session 7 |
| Institution dashboard | 🔲 Stub | Session 8 |
| TypeScript SDK | 🔲 Stub | Session 9 |
| Tests & security audit | 🔲 Stub | Session 10 |

---

## Environment Variables Reference

| Variable | Description | Where to Get |
|---|---|---|
| `SOLANA_NETWORK` | `devnet` / `mainnet-beta` | — |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Helius, QuickNode, or public devnet |
| `JWT_SECRET` | API auth secret | Generate: `openssl rand -hex 32` |
| `DATABASE_URL` | PostgreSQL connection string | Local or Supabase |
| `ELLIPTIC_API_KEY` | KYT/AML screening | elliptic.co |
| `SMILE_ID_API_KEY` | Africa-specific KYC | smileidentity.com |
| `SIX_API_KEY` | FX rates (hackathon partner) | Request via hackathon Discord |
| `YELLOW_CARD_API_KEY` | NGN/KES on/off ramp | yellowcard.io |
| `BITNOB_API_KEY` | West Africa on/off ramp | bitnob.com |
| `TRISA_ENDPOINT` | Travel Rule VASP endpoint | trisa.io |

---

## Next Session

**Session 2 — Solana Programs (On-Chain Core)**

Four Anchor programs get fully implemented:
1. `stablecoin-token` — Token-2022 mint with Transfer Hook, Default Account State,
   Required Memo, and Token ACL extensions
2. `treasury-pool` — USDC liquidity pool with multi-corridor accounting
3. `transfer-hook` — Atomic KYT compliance gatekeeper on every transfer
4. `routing-logic` — Multi-corridor path selection and multi-sig authorization

This is the core differentiator of the entire build.

