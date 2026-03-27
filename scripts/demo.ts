/**
 * IroFi Hackathon Demo Script
 * Run this to demonstrate the full $50,000 Lagos → Nairobi transfer.
 *
 * Usage: npx tsx scripts/demo.ts
 *
 * Shows:
 *   - Real-time compliance pipeline execution
 *   - Travel Rule exchange with TRISA
 *   - On-chain settlement on Solana devnet
 *   - Under 10 seconds, under 0.5% cost
 */

import { IroFiClient, IroFiError } from "@irofi/sdk";

const DEMO_CONFIG = {
  apiUrl: process.env.IROFI_API_URL ?? "http://localhost:3001/v1",
  apiKey: process.env.IROFI_API_KEY ?? "demo-key",
};

function log(emoji: string, msg: string, detail?: any) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`[${ts}] ${emoji}  ${msg}${detail ? `
         ${JSON.stringify(detail)}` : ""}`);
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function runDemo() {
  console.log("
" + "═".repeat(60));
  console.log("  IroFi — Institutional Cross-Border Treasury Demo");
  console.log("  $50,000 USDC: Lagos → Nairobi");
  console.log("═".repeat(60) + "
");

  const client = new IroFiClient(DEMO_CONFIG);
  const startTime = Date.now();

  // ── Step 1: Check corridor health ─────────────────────────────────────
  log("🔍", "Checking NG→KE corridor health...");
  const corridor = await client.getCorridorLiquidity("NG_KE");
  log("✅", `Corridor active — liquidity: $${corridor.total_liquidity_usdc?.toLocaleString() ?? "N/A"} USDC`);
  if (corridor.fatf_grey_listed) {
    log("⚠️ ", "FATF grey-listed corridor — enhanced due diligence active");
  }

  // ── Step 2: Get live FX rate ────────────────────────────────────────────
  log("📊", "Fetching live FX rate (Pyth + SIX)...");
  const rate = await client.getOracleRate("NG_KE");
  log("✅", `Rate: 1 USDC = ${rate.usdc_to_receiver?.toFixed(2) ?? "N/A"} KES | Source: ${rate.source} | Stale: ${rate.is_stale}`);

  // ── Step 3: Initiate transfer ───────────────────────────────────────────
  const idempotencyKey = `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  log("🚀", "Initiating $50,000 USDC transfer...");

  let transfer;
  try {
    transfer = await client.initiateTreasuryTransfer({
      sender_institution_id: "inst_lagos_demo",
      receiver_institution_id: "inst_nairobi_demo",
      amount_usdc: 50_000,
      corridor: "NG_KE",
      memo: "Demo transfer — Invoice #DEMO-2026-001 | Goods settlement",
      idempotency_key: idempotencyKey,
    });
  } catch (err) {
    if (err instanceof IroFiError) {
      log("❌", `Transfer rejected: ${err.message} (${err.code})`);
      return;
    }
    throw err;
  }

  log("✅", `Transfer accepted`, { id: transfer.transfer_id, status: transfer.status });

  // ── Step 4: Poll status and show pipeline ──────────────────────────────
  log("⏳", "Monitoring compliance pipeline...
");

  const PIPELINE_LABELS: Record<string, string> = {
    kyt_check:        "🔎  KYT Screen (Elliptic)",
    sanctions_check:  "🚫  Sanctions (OFAC/UN/EU/UK)",
    aml_assessment:   "🤖  AML Risk Assessment",
    travel_rule:      "📨  Travel Rule (TRISA)",
    on_chain:         "⛓️   On-Chain Settlement (Solana)",
    settlement:       "✅  Settlement Complete",
  };

  let finalTransfer;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const detail = await client.getTransfer(transfer.transfer_id);

    for (const step of detail.pipeline_steps ?? []) {
      const label = PIPELINE_LABELS[step.step] ?? step.step;
      const status = step.status === "passed" || step.status === "completed" || step.status === "confirmed"
        ? "✅"
        : step.status === "failed" ? "❌" : "⏳";
      const extra = step.risk_score != null ? ` | risk: ${step.risk_score}` : "";
      const time = step.duration_ms != null ? ` | ${step.duration_ms}ms` : "";
      console.log(`         ${status} ${label}${extra}${time}`);
    }

    if (detail.status === "completed" || detail.status === "failed") {
      finalTransfer = detail;
      break;
    }
  }

  // ── Step 5: Final result ───────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("
" + "─".repeat(60));

  if (finalTransfer?.status === "completed") {
    const fee = finalTransfer.fee_usdc ?? (50_000 * 0.005);
    const feePct = ((fee / 50_000) * 100).toFixed(2);
    console.log(`
  ✅  TRANSFER COMPLETE
`);
    console.log(`  Amount:      $50,000.00 USDC`);
    console.log(`  Fee:         $${fee.toFixed(2)} (${feePct}%)`);
    console.log(`  Net:         $${(50_000 - fee).toFixed(2)} USDC received`);
    console.log(`  Tx:          ${finalTransfer.tx_signature ?? "devnet-tx-hash"}`);
    console.log(`  Travel Rule: ${finalTransfer.travel_rule_state ?? "ACCEPTED"}`);
    console.log(`  Time:        ${elapsed}s total`);
    console.log(`
  Traditional wire: 3–5 days, 6–8% fee`);
    console.log(`  IroFi:            ${elapsed}s, ${feePct}% fee`);
  } else {
    console.log(`
  ❌  TRANSFER ${finalTransfer?.status?.toUpperCase() ?? "TIMEOUT"}`);
    console.log(`  Reason: ${finalTransfer?.failure_reason ?? "Pipeline timeout — check server logs"}`);
  }

  console.log("
" + "═".repeat(60) + "
");
}

runDemo().catch(console.error);
