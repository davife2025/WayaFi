# IroFi — Version Patch

Two issues fixed:
1. `@pythnetwork/price-service-client` latest is `1.11.0`, not `0.5.0`
2. `@solana/web3.js@2.0.0` is deprecated — use `1.95.3` (wallet adapters all require v1)

## Apply the patch

Copy each file to replace the matching file in your project:

| Patch file | Replace this file in your project |
|---|---|
| `package.json` | `package.json` (root) |
| `oracle-package.json` | `packages/oracle/package.json` |
| `api-package.json` | `apps/api/package.json` |
| `web-package.json` | `apps/web/package.json` |

Then run:

```bash
pnpm install
```

Should complete with 0 errors.

## What changed

### Root `package.json`
Added `pnpm.overrides` to pin `@solana/web3.js` to `^1.95.3` across the entire
monorepo. This prevents any transitive dependency from pulling in v2.

### `packages/oracle/package.json`
```diff
- "@pythnetwork/price-service-client": "^0.5.0"
+ "@pythnetwork/price-service-client": "^1.11.0"
```

### `apps/api/package.json` and `apps/web/package.json`
```diff
- "@solana/web3.js": "^2.0.0"
+ "@solana/web3.js": "^1.95.3"
```
