# IroFi — Session 6: Oracle & FX Integration

## What Was Built

Real-time FX rates powering smart treasury routing via Pyth + SIX.

### Files

| File | Purpose |
|---|---|
| `packages/oracle/src/types.ts` | PythPriceFeed, SIXFXRate, CorridorFXRate, OracleHealthStatus |
| `packages/oracle/src/pyth.ts` | PythClient — price feeds, streaming, VAA for on-chain submission |
| `packages/oracle/src/six.ts` | SIXClient — FX rates, precious metals, batch fetch |
| `packages/oracle/src/fx-engine.ts` | FXRateEngine — corridor rates, rate-triggered routing, alerts |
| `apps/api/src/oracle/routes.ts` | 5 Fastify endpoints |

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/oracle/rates` | All corridor rates |
| GET | `/v1/oracle/rates/:corridor` | Single corridor rate |
| POST | `/v1/oracle/evaluate-threshold` | Check if rate meets transfer threshold |
| GET | `/v1/oracle/metals` | Precious metal prices (SIX) |
| GET | `/v1/oracle/health` | Oracle feed health |

### Data Flow

```
SIX API ──────────────────────┐
                              ├── FXRateEngine.getCorridorRate()
Pyth Network (fallback) ──────┘         │
                                        ▼
                              CorridorFXRate { implied_rate, spread_bps, is_stale }
                                        │
                                        ▼
                              FXRateEngine.evaluateRateThreshold()
                                        │
                              ┌─────────┴────────┐
                           Execute         Hold until
                           transfer        rate improves
```

### Rate-Triggered Routing

Institutions can set a minimum acceptable FX rate for transfers.
The API holds the transfer until the rate is met:

```bash
POST /v1/oracle/evaluate-threshold
{
  "corridor": "NG_KE",
  "amount_usdc": 50000,
  "target_rate": 130.5,    # min KES per NGN
  "tolerance_bps": 50      # allow 0.5% below target
}
```

### SIX Integration

SIX is the hackathon's official data partner. Configure:
```bash
SIX_API_KEY=your_six_api_key
SIX_FX_ENDPOINT=https://api.six-group.com/api/findata/v1
```

Request access via the hackathon Discord.
