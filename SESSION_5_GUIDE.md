# IroFi — Session 5: Backend API Layer

## What Was Built

The full Fastify API server orchestrating all services.

### Files

| File | Purpose |
|---|---|
| `src/index.ts` | Server bootstrap — plugins, hooks, route registration |
| `src/middleware/auth.ts` | JWT + Solana wallet signature auth |
| `src/middleware/logger.ts` | Request logging |
| `src/routes/transfers.ts` | Transfer lifecycle — initiate, status, list |
| `src/routes/institutions.ts` | Institution registration + wallet auth |
| `src/routes/corridors.ts` | Corridor liquidity + health |
| `src/routes/webhooks.ts` | Webhook subscription + delivery |
| `src/workers/event-indexer.ts` | Solana log listener → webhook dispatcher |
| `src/db/schema.ts` | Drizzle ORM schema |
| `src/db/migrations/0001_initial.sql` | PostgreSQL migration |
| `src/db/index.ts` | DB client |

### API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/v1/auth/challenge` | Public | Get sign-in challenge |
| POST | `/v1/auth/login` | Public | Verify wallet sig → JWT |
| POST | `/v1/institutions` | JWT | Register institution |
| GET | `/v1/institutions/:id` | JWT | Get institution |
| POST | `/v1/transfers` | JWT | Initiate transfer |
| GET | `/v1/transfers/:id` | JWT | Transfer status + audit trail |
| GET | `/v1/transfers` | JWT | List transfers |
| GET | `/v1/corridors` | Public | All corridors + liquidity |
| GET | `/v1/corridors/:id` | Public | Single corridor stats |
| POST | `/v1/webhooks` | JWT | Register webhook |
| GET | `/v1/webhooks` | JWT | List webhooks |
| DELETE | `/v1/webhooks/:id` | JWT | Remove webhook |

### Transfer Pipeline Steps

```
POST /v1/transfers
   │
   ├── 1. Idempotency check (DB)
   ├── 2. KYT screen (Elliptic) ─────────── fail → 422 + compliance.rejected webhook
   ├── 3. Sanctions check (Elliptic) ─────── fail → 422 + blocked
   ├── 4. AML assessment ─────────────────── hold → 202 + compliance.hold webhook
   ├── 5. Travel Rule exchange (TRISA) ───── fail → 422 + travel_rule.rejected
   ├── 6. Routing intent (Solana) ────────── multisig if amount ≥ threshold
   ├── 7. On-chain settlement (Solana) ───── tx_signature recorded
   └── 8. Webhook delivery ────────────────── transfer.completed or transfer.failed
```

### Running Locally

```bash
# Start DB
docker run -e POSTGRES_PASSWORD=irofi -p 5432:5432 postgres:16

# Run migration
pnpm db:push

# Start API
pnpm dev
# → IroFi API running on port 3001
```

### Auth Flow (Wallet Sign-In)

```bash
# 1. Get challenge
curl -X POST http://localhost:3001/v1/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "YOUR_WALLET"}'

# 2. Sign the challenge with your Solana wallet

# 3. Exchange for JWT
curl -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "YOUR_WALLET", "signature": "SIGNED_CHALLENGE"}'

# 4. Use the token
curl http://localhost:3001/v1/transfers \
  -H "Authorization: Bearer YOUR_JWT"
```

### Event Indexer

The `EventIndexer` worker runs alongside the API, subscribing to Solana
program logs via WebSocket. When SettlementCompleted fires on-chain, it:
1. Updates transfer status in PostgreSQL
2. Delivers `transfer.completed` webhook to the institution
3. Logs a compliance audit event

Start the indexer:
```typescript
import { EventIndexer } from "./workers/event-indexer";
const indexer = new EventIndexer(process.env.SOLANA_RPC_URL!);
await indexer.start();
```