# IroFi — Session 4: Travel Rule Module (TRISA)

## What Was Built

The most underbuilt layer in the African stablecoin ecosystem.

### Files

| File | Purpose |
|---|---|
| `packages/travel-rule/src/types.ts` | IVMS101 types, TRISA envelope types, threshold tables |
| `packages/travel-rule/src/envelope.ts` | AES-256-GCM + RSA-OAEP secure envelope |
| `packages/travel-rule/src/vasp-directory.ts` | TRISA GDS lookup, cert validation, sunrise handler |
| `packages/travel-rule/src/trisa-client.ts` | Full exchange lifecycle + IVMS101 builder |
| `apps/api/src/travel-rule/routes.ts` | 3 Fastify endpoints |

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/travel-rule/initiate` | Start exchange for outbound transfer |
| POST | `/travel-rule/incoming` | Receive TRISA inquiry (IroFi as beneficiary) |
| GET | `/travel-rule/vasp/:address` | VASP registration lookup |

### Travel Rule Thresholds

| Jurisdiction | Threshold |
|---|---|
| NG, KE, GH, EU, UK | $0 — all transfers |
| US, ZA | $1,000 |

### Sunrise Problem Handling

- Transfer >= $10,000 → BLOCK
- Transfer >= $1,000 + grey-listed → BLOCK
- Transfer < $1,000 + standard → PROCEED with audit log

### Required Env Vars

```bash
IROFI_VASP_DID=
TRISA_PRIVATE_KEY_PEM=
TRISA_CERTIFICATE_PEM=
TRISA_HMAC_SECRET=
TRISA_GDS_ENDPOINT=https://api.trisatest.net
```