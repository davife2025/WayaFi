# IroFi — Session 8: Institution Dashboard

## What Was Built

Full Next.js 14 dashboard — treasury overview, corridor cards, transfer table,
compliance panel, and a multi-step transfer initiation form.

### File Map

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout — Inter font, dark theme |
| `src/app/globals.css` | Tailwind + IroFi CSS variables |
| `src/app/providers.tsx` | QueryClient + Solana wallet providers |
| `src/app/page.tsx` | Main dashboard (wallet-gated) |
| `src/app/transfer/page.tsx` | Transfer initiation page |
| `src/app/compliance/page.tsx` | Compliance + audit log page |
| `src/components/dashboard/TreasuryOverview.tsx` | 4 stat cards |
| `src/components/dashboard/CorridorCards.tsx` | 5 corridor cards with liquidity |
| `src/components/transfers/TransferTable.tsx` | Transfer history with status badges |
| `src/components/transfers/TransferForm.tsx` | Multi-step transfer form + compliance banner |
| `src/components/compliance/CompliancePanel.tsx` | KYC/AML/sanctions status |
| `src/components/compliance/AuditLog.tsx` | Compliance event log |
| `src/components/ui/Navbar.tsx` | Sticky nav + WalletMultiButton |
| `src/lib/api.ts` | Typed API client |
| `src/hooks/*.ts` | React Query hooks for all data |

### Running

```bash
cd apps/web
cp ../../.env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001/v1
pnpm dev
# → http://localhost:3000
```

### Wallet Auth Flow
1. Connect Phantom or Solflare wallet
2. Dashboard unlocks automatically
3. Transfer form uses wallet address as institution identifier
4. JWT issued via wallet signature challenge/response
