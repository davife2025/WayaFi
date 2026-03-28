"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

const CORRIDORS = [
  { id: "NG_KE", label: "Nigeria → Kenya",        fx: "NGN/KES" },
  { id: "NG_ZA", label: "Nigeria → South Africa", fx: "NGN/ZAR" },
  { id: "NG_GH", label: "Nigeria → Ghana",        fx: "NGN/GHS" },
  { id: "KE_ZA", label: "Kenya → South Africa",   fx: "KES/ZAR" },
  { id: "KE_GH", label: "Kenya → Ghana",          fx: "KES/GHS" },
];

const STEPS = ["Details", "Compliance", "Confirm"];

type Step = "form" | "compliance" | "confirming" | "done";

const STEP_IDX: Record<Step, number> = { form: 0, compliance: 1, confirming: 2, done: 2 };

const field: React.CSSProperties = { marginBottom: "1.25rem" };

export function TransferForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    corridor:                "NG_KE",
    amount_usdc:             "",
    memo:                    "",
    receiver_institution_id: "",
  });
  const [step, setStep] = useState<Step>("form");
  const [txResult, setTxResult] = useState<any>(null);

  const { data: rateData } = useQuery({
    queryKey: ["corridor-rate", form.corridor],
    queryFn:  () => apiClient.get(`/oracle/rates/${form.corridor}`),
    enabled:  !!form.corridor,
  });

  const mutation = useMutation({
    mutationFn: (payload: any) => apiClient.post("/transfers", payload),
    onSuccess:  (data) => { setTxResult(data); setStep("done"); },
  });

  const handleSubmit = async () => {
    setStep("compliance");
    await new Promise((r) => setTimeout(r, 1800));
    setStep("confirming");
    mutation.mutate({
      ...form,
      amount_usdc:          Number(form.amount_usdc),
      idempotency_key:      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender_institution_id: "inst_self",
    });
  };

  const amt = Number(form.amount_usdc);
  const travelRuleRequired = amt >= 1000;
  const canSubmit = !!form.amount_usdc && !!form.memo && !!form.receiver_institution_id && step === "form";

  // ── Done state ──────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--teal-dim)", border: "1px solid var(--border-accent)",
          marginBottom: "1.5rem",
          boxShadow: "0 0 24px var(--teal-glow)",
        }}>
          <span style={{ color: "var(--teal)", fontSize: "1.4rem" }}>✓</span>
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem", color: "var(--text)", marginBottom: "0.5rem" }}>
          Transfer Initiated
        </h2>
        <p style={{ fontSize: "0.77rem", color: "var(--text-3)", marginBottom: "1.5rem" }}>
          On-chain settlement in progress
        </p>
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 3, padding: "1rem", marginBottom: "1.5rem", textAlign: "left" }}>
          {[
            ["Transfer ID",   txResult?.transfer_id ?? "—"],
            ["Est. Settlement", `${txResult?.estimated_completion_seconds ?? 8}s`],
            ["Rail",          "Solana Token-2022 · Transfer Hook"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{k}</span>
              <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--teal)" }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={() => router.push("/")} className="btn btn-primary" style={{ width: "100%" }}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  // ── Processing banner ────────────────────────────────────────────────────

  const processingBanner = step !== "form" && (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      padding: "0.75rem 1rem", marginBottom: "1.25rem",
      background: "var(--amber-dim)", border: "1px solid rgba(240,165,0,0.15)",
      borderRadius: 3,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%",
        border: "2px solid var(--amber)", borderTopColor: "transparent",
        animation: "spin 0.8s linear infinite", flexShrink: 0,
      }} />
      <div>
        <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--amber)" }}>
          {step === "compliance" ? "Running compliance checks…" : "Submitting to Solana…"}
        </p>
        <p style={{ fontSize: "0.67rem", color: "var(--text-3)", marginTop: "0.1rem" }}>
          KYT · Sanctions · AML scoring · {travelRuleRequired ? "Travel Rule · " : ""}Transfer Hook
        </p>
      </div>
    </div>
  );

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {STEPS.map((label, i) => {
          const current = STEP_IDX[step];
          const done = i < current;
          const active = i === current;
          return (
            <div key={label} style={{ flex: 1 }}>
              <div style={{
                height: 3, borderRadius: 2, marginBottom: "0.35rem",
                background: done || active ? "var(--teal)" : "var(--bg-3)",
                boxShadow: active ? "0 0 8px var(--teal-glow)" : "none",
                transition: "background 0.3s",
              }} />
              <span style={{
                fontSize: "0.65rem", letterSpacing: "0.07em", textTransform: "uppercase",
                fontWeight: 600,
                color: active ? "var(--teal)" : done ? "var(--text-2)" : "var(--text-3)",
              }}>
                {done ? "✓ " : ""}{label}
              </span>
            </div>
          );
        })}
      </div>

      {processingBanner}

      {/* Corridor select */}
      <div style={field}>
        <label className="field-label">Payment Corridor</label>
        <select
          value={form.corridor}
          onChange={(e) => setForm((f) => ({ ...f, corridor: e.target.value }))}
          className="field-select"
          disabled={step !== "form"}
        >
          {CORRIDORS.map((c) => (
            <option key={c.id} value={c.id}>{c.label} — {c.fx}</option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div style={field}>
        <label className="field-label">Amount (USDC)</label>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)",
            color: "var(--text-3)", fontSize: "0.8rem",
          }}>$</span>
          <input
            type="number"
            value={form.amount_usdc}
            onChange={(e) => setForm((f) => ({ ...f, amount_usdc: e.target.value }))}
            placeholder="0.00"
            className="field-input"
            style={{ paddingLeft: "1.5rem" }}
            disabled={step !== "form"}
          />
        </div>
        {/* Rate + fee breakdown */}
        {amt > 0 && (
          <div style={{
            marginTop: "0.5rem", padding: "0.6rem 0.75rem",
            background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 3,
            display: "flex", flexDirection: "column", gap: "0.2rem",
          }}>
            {rateData?.implied_rate && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                <span style={{ color: "var(--text-3)" }}>FX Rate (Pyth)</span>
                <span style={{ color: "var(--teal)", fontFamily: "var(--font-mono)" }}>
                  1 USDC ≈ {rateData.implied_rate.toFixed(4)} {rateData.receiver_currency}
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
              <span style={{ color: "var(--text-3)" }}>Platform Fee (15bps)</span>
              <span style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>
                ${(amt * 0.0015).toFixed(2)}
              </span>
            </div>
            {travelRuleRequired && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                marginTop: "0.2rem", paddingTop: "0.35rem", borderTop: "1px solid var(--border)",
              }}>
                <span className="badge badge-amber" style={{ fontSize: "0.6rem" }}>Travel Rule</span>
                <span style={{ fontSize: "0.67rem", color: "var(--text-3)" }}>TRISA envelope required (≥ $1,000)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Memo */}
      <div style={field}>
        <label className="field-label">
          Memo <span style={{ color: "var(--text-3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            (Travel Rule reference — required)
          </span>
        </label>
        <input
          type="text"
          value={form.memo}
          onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
          placeholder="INV-2026-001 — goods settlement"
          className="field-input"
          disabled={step !== "form"}
        />
      </div>

      {/* Receiver */}
      <div style={field}>
        <label className="field-label">Receiver Institution ID</label>
        <input
          type="text"
          value={form.receiver_institution_id}
          onChange={(e) => setForm((f) => ({ ...f, receiver_institution_id: e.target.value }))}
          placeholder="inst_nairobi_001"
          className="field-input"
          disabled={step !== "form"}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center", padding: "0.65rem", fontSize: "0.8rem" }}
      >
        {step === "form" ? "Run Compliance & Initiate Transfer" : "Processing…"}
      </button>

      {/* CSS for spinner */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
