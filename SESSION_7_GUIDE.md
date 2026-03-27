# IroFi — Session 7: On/Off Ramp Adapter Layer

## What Was Built

Pluggable fiat bridge — three adapters covering all 5 IroFi corridors.

### Files

| File | Provider | Corridors |
|---|---|---|
| `packages/ramp/src/types.ts` | Interface + types | All |
| `packages/ramp/src/yellow-card.ts` | Yellow Card | NG, KE, ZA, GH, UG |
| `packages/ramp/src/bitnob.ts` | Bitnob | NG, GH |
| `packages/ramp/src/muda.ts` | Muda | KE, UG, TZ |
| `packages/ramp/src/ramp-manager.ts` | Manager | All — best-rate routing |
| `apps/api/src/ramp/routes.ts` | API | All endpoints |

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/ramp/quote` | Best quote across providers |
| GET | `/v1/ramp/quotes/compare` | All provider quotes side-by-side |
| POST | `/v1/ramp/orders` | Create ramp order |
| GET | `/v1/ramp/orders/:provider/:id` | Order status |
| POST | `/v1/ramp/webhook/:provider` | Receive provider webhooks |

### Provider Coverage

| Currency | Yellow Card | Bitnob | Muda |
|---|---|---|---|
| NGN | ✅ | ✅ | ❌ |
| KES | ✅ | ❌ | ✅ |
| ZAR | ✅ | ❌ | ❌ |
| GHS | ✅ | ✅ | ❌ |
| UGX | ✅ | ❌ | ✅ |

### Adding a New Provider

1. Create `packages/ramp/src/your-provider.ts` implementing `RampAdapter`
2. Add to `PROVIDER_COVERAGE` in types.ts
3. Register in `RampManager` constructor
4. Add API key to `.env.example`

### Required Env Vars

```bash
YELLOW_CARD_API_KEY=
YELLOW_CARD_API_SECRET=
BITNOB_API_KEY=
MUDA_API_KEY=
MUDA_API_SECRET=
```
