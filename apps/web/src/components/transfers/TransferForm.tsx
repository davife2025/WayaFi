"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

const CORRIDORS = ["NG_KE", "NG_ZA", "NG_GH", "KE_ZA", "KE_GH"];

export function TransferForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    corridor: "NG_KE",
    amount_usdc: "",
    memo: "",
    receiver_institution_id: "",
    fx_rate_limit: "",
  });
  const [step, setStep] = useState<"form" | "compliance" | "confirming" | "done">("form");
  const [txResult, setTxResult] = useState<any>(null);

  // FX rate query
  const { data: rateData } = useQuery({
    queryKey: ["corridor-rate", form.corridor],
    queryFn: () => apiClient.get(`/oracle/rates/${form.corridor}`),
    enabled: !!form.corridor,
  });

  const transferMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post("/transfers", payload),
    onSuccess: (data) => {
      setTxResult(data);
      setStep("done");
    },
  });

  const handleSubmit = async () => {
    setStep("compliance");
    await new Promise((r) => setTimeout(r, 1500)); // simulate compliance check
    setStep("confirming");
    transferMutation.mutate({
      ...form,
      amount_usdc: Number(form.amount_usdc),
      idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender_institution_id: "inst_self",
    });
  };

  if (step === "done") {
    return (
      <div className="irofi-card text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-bold text-white">Transfer Initiated</h2>
        <p className="text-zinc-400 text-sm">
          Transfer ID: <span className="font-mono text-zinc-300">{txResult?.transfer_id}</span>
        </p>
        <p className="text-zinc-500 text-xs">
          Estimated settlement: {txResult?.estimated_completion_seconds ?? 10}s
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-6 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--irofi-green)", color: "#000" }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compliance status banner */}
      {step !== "form" && (
        <div className="irofi-card border-amber-600/40 bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="animate-spin text-lg">⚙️</div>
            <div>
              <p className="text-sm font-medium text-amber-400">
                {step === "compliance" ? "Running compliance checks…" : "Submitting to chain…"}
              </p>
              <p className="text-xs text-zinc-500">KYT · Sanctions · AML · Travel Rule</p>
            </div>
          </div>
        </div>
      )}

      <div className="irofi-card space-y-4">
        {/* Corridor */}
        <div>
          <label className="text-xs text-zinc-400 uppercase tracking-wider">Corridor</label>
          <select
            value={form.corridor}
            onChange={(e) => setForm((f) => ({ ...f, corridor: e.target.value }))}
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {CORRIDORS.map((c) => <option key={c} value={c}>{c.replace("_", " → ")}</option>)}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-zinc-400 uppercase tracking-wider">Amount (USDC)</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
            <input
              type="number"
              value={form.amount_usdc}
              onChange={(e) => setForm((f) => ({ ...f, amount_usdc: e.target.value }))}
              placeholder="0.00"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm"
            />
          </div>
          {rateData?.implied_rate && (
            <p className="text-xs text-zinc-500 mt-1">
              Current rate: 1 USDC ≈ {rateData.implied_rate.toFixed(2)} {rateData.receiver_currency}
            </p>
          )}
        </div>

        {/* Memo */}
        <div>
          <label className="text-xs text-zinc-400 uppercase tracking-wider">
            Memo <span className="text-zinc-600">(Travel Rule reference)</span>
          </label>
          <input
            type="text"
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            placeholder="Invoice #INV-2026-001 — goods settlement"
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>

        {/* Receiver */}
        <div>
          <label className="text-xs text-zinc-400 uppercase tracking-wider">Receiver Institution ID</label>
          <input
            type="text"
            value={form.receiver_institution_id}
            onChange={(e) => setForm((f) => ({ ...f, receiver_institution_id: e.target.value }))}
            placeholder="inst_nairobi_001"
            className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!form.amount_usdc || !form.memo || !form.receiver_institution_id || step !== "form"}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--irofi-green)", color: "#000" }}
        >
          Initiate Transfer
        </button>
      </div>
    </div>
  );
}
