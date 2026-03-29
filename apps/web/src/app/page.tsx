"use client";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "@/components/ui/Navbar";
import { TreasuryOverview } from "@/components/dashboard/TreasuryOverview";
import { CorridorCards } from "@/components/dashboard/CorridorCards";
import { TransferTable } from "@/components/transfers/TransferTable";
import { CompliancePanel } from "@/components/compliance/CompliancePanel";

// ── Connect Gate ─────────────────────────────────────────────────────────────

function ConnectGate() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(14,232,177,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(14,232,177,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
      }} />

      {/* Glow */}
      <div style={{
        position: "absolute", width: 500, height: 500,
        background: "radial-gradient(circle, rgba(14,232,177,0.05) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", textAlign: "center", maxWidth: 420, padding: "0 1.5rem" }}>
        {/* Logo mark */}
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 56, height: 56, borderRadius: 6,
          background: "var(--bg-2)", border: "1px solid var(--border-accent)",
          marginBottom: "2rem", boxShadow: "0 0 32px var(--teal-glow)",
        }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem", color: "var(--teal)" }}>W</span>
        </div>

        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 800,
          fontSize: "2.2rem", letterSpacing: "-0.04em",
          color: "var(--text)", lineHeight: 1, marginBottom: "0.75rem",
        }}>
          WayaFi Treasury
        </h1>

        <p style={{ color: "var(--text-2)", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: "2.5rem" }}>
          Institutional cross-border USDC settlement for African financial corridors.
          Compliance-first. Solana-native.
        </p>

        <WalletMultiButton />

        {/* Capability tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", marginTop: "2rem" }}>
          {["KYC/KYT", "AML Screening", "Travel Rule", "TRISA", "FATF-Aligned", "Solana Token-2022"].map((tag) => (
            <span key={tag} className="badge badge-ghost">{tag}</span>
          ))}
        </div>

        {/* Active corridors strip */}
        <div style={{
          marginTop: "2.5rem", paddingTop: "1.5rem",
          borderTop: "1px solid var(--border)",
          display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center",
        }}>
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", width: "100%", marginBottom: "0.4rem" }}>
            Active Corridors
          </span>
          {["NG→KE", "NG→GH", "NG→ZA", "KE→UG", "KE→TZ", "GH→ZA"].map((c) => (
            <span key={c} className="corridor-tag">{c}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { connected } = useWallet();
  if (!connected) return <ConnectGate />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "1.5rem 1.25rem" }}>

        {/* Page header */}
        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          marginBottom: "1.5rem", paddingBottom: "1rem",
          borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="live-dot" />
              <span style={{ fontSize: "0.67rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)" }}>
                Live — Solana Mainnet
              </span>
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: "1.4rem", letterSpacing: "-0.03em", color: "var(--text)",
            }}>
              Treasury Overview
            </h1>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href="/compliance" className="btn btn-outline">Compliance Centre</Link>
            <Link href="/transfer" className="btn btn-primary">+ New Transfer</Link>
          </div>
        </div>

        {/* Stats row */}
        <TreasuryOverview />

        {/* Corridors */}
        <section style={{ marginTop: "1.5rem" }}>
          <CorridorCards />
        </section>

        {/* Transfers + Compliance */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1rem", marginTop: "1.5rem" }}>
          <TransferTable />
          <CompliancePanel />
        </section>

      </main>
    </div>
  );
}