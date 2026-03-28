"use client";
import { Navbar } from "@/components/ui/Navbar";
import { TransferForm } from "@/components/transfers/TransferForm";

export default function TransferPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "1.5rem 1.25rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: "0.67rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "0.25rem" }}>
            Treasury · New Transfer
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", letterSpacing: "-0.03em", color: "var(--text)" }}>
            Initiate Cross-Border Transfer
          </h1>
          <p style={{ fontSize: "0.77rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
            KYC/KYT gated · AML screened · Travel Rule enforced · Solana Token-2022
          </p>
        </div>

        {/* Form card */}
        <div className="card">
          <div className="card-body">
            <TransferForm />
          </div>
        </div>

        {/* Compliance footer */}
        <div style={{
          marginTop: "1rem", padding: "0.75rem 1rem",
          background: "var(--teal-dim)", border: "1px solid rgba(14,232,177,0.12)",
          borderRadius: 3, display: "flex", gap: "0.6rem",
        }}>
          <span style={{ color: "var(--teal)", flexShrink: 0, fontSize: "0.8rem", marginTop: "0.05rem" }}>◈</span>
          <p style={{ fontSize: "0.7rem", color: "var(--text-3)", lineHeight: 1.6 }}>
            All transfers are screened against OFAC, UN, EU, and HMT sanctions in real time.
            Transfers ≥ $1,000 require TRISA Travel Rule envelope exchange before on-chain execution.
            Every compliance event is anchored on-chain for immutable audit.
          </p>
        </div>

      </main>
    </div>
  );
}
