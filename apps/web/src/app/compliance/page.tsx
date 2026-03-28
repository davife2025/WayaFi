"use client";
import { useState } from "react";
import { Navbar } from "@/components/ui/Navbar";
import { CompliancePanel } from "@/components/compliance/CompliancePanel";
import { AuditLog } from "@/components/compliance/AuditLog";

type Tab = "overview" | "audit" | "sanctions" | "travel-rule";

const TABS: { id: Tab; label: string; count?: number }[] = [
  { id: "overview",    label: "KYC / AML"       },
  { id: "audit",       label: "Audit Log"        },
  { id: "sanctions",   label: "Sanctions", count: 2 },
  { id: "travel-rule", label: "Travel Rule", count: 1 },
];

const SANCTIONS = [
  { wallet: "7xKp...9Rr2", list: "OFAC SDN",    match: "EXACT",  action: "BLOCKED",  entity: "Blocked Entity Ltd",         time: "2h ago" },
  { wallet: "3mLq...7Pp5", list: "UN Security", match: "FUZZY", action: "FLAGGED",  entity: "Partial match — under review", time: "6h ago" },
  { wallet: "9nTw...1Kk8", list: "EU",          match: "FUZZY", action: "CLEARED",  entity: "False positive confirmed",     time: "1d ago" },
];

const TRAVEL_RULE = [
  { id: "TR-0022", from: "Zenith Bank NG", to: "KCB Kenya",      amount: "$210,000", corridor: "NG→KE", status: "AWAITING",  expires: "13 min" },
  { id: "TR-0021", from: "First Bank NG",  to: "Equity Bank KE", amount: "$95,000",  corridor: "NG→KE", status: "CONFIRMED", expires: "—"      },
  { id: "TR-0020", from: "GTBank NG",      to: "Absa ZA",        amount: "$44,000",  corridor: "NG→ZA", status: "CONFIRMED", expires: "—"      },
];

function actionBadge(action: string) {
  if (action === "BLOCKED")   return <span className="badge badge-red">{action}</span>;
  if (action === "FLAGGED")   return <span className="badge badge-amber">{action}</span>;
  if (action === "CLEARED")   return <span className="badge badge-teal">{action}</span>;
  if (action === "AWAITING")  return <span className="badge badge-amber">{action}</span>;
  if (action === "CONFIRMED") return <span className="badge badge-teal">{action}</span>;
  return <span className="badge badge-ghost">{action}</span>;
}

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "1.5rem 1.25rem" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <p style={{ fontSize: "0.67rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "0.25rem" }}>
              Treasury · Compliance Centre
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", letterSpacing: "-0.03em", color: "var(--text)" }}>
              Compliance Dashboard
            </h1>
            <p style={{ fontSize: "0.77rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
              KYC · AML · Sanctions · Travel Rule · Audit trail
            </p>
          </div>
          <button className="btn btn-outline" style={{ fontSize: "0.7rem" }}>↓ Export Report</button>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: "KYC Verified",        value: "1,284", delta: "+12 today",   pos: true  },
            { label: "Pending Review",       value: "7",     delta: "Avg 2.3h",   pos: null  },
            { label: "Sanctions Hits (30d)", value: "3",     delta: "2 blocked",  pos: false },
            { label: "Travel Rule Pending",  value: "1",     delta: "TRISA",      pos: null  },
            { label: "Avg AML Score",        value: "12.4",  delta: "LOW band",   pos: true  },
          ].map((s) => (
            <div key={s.label} className="stat-tile">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value tabular" style={{ fontSize: "1.4rem" }}>{s.value}</div>
              <div className={`stat-delta ${s.pos === false ? "neg" : s.pos === null ? "neu" : ""}`}>
                {s.delta}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1.25rem" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.55rem 1rem",
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: `2px solid ${tab === t.id ? "var(--teal)" : "transparent"}`,
                color: tab === t.id ? "var(--teal)" : "var(--text-3)",
                fontSize: "0.72rem", fontFamily: "var(--font-mono)", fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                marginBottom: -1, transition: "color 0.1s",
              }}
            >
              {t.label}
              {t.count && (
                <span className="badge badge-amber" style={{ fontSize: "0.62rem", padding: "0.1rem 0.35rem" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1rem" }} className="animate-fade-in">
            <CompliancePanel />
            <div className="card">
              <div className="card-header">
                <span className="card-title">KYC Pipeline</span>
                <span style={{ fontSize: "0.67rem", color: "var(--text-3)" }}>Smile ID · Manual · On-chain</span>
              </div>
              <table className="data-table">
                <thead><tr><th>Stage</th><th>Provider</th><th>SLA</th><th>Coverage</th></tr></thead>
                <tbody>
                  {[
                    ["Identity document upload",    "Smile ID",            "< 30s",   "All jurisdictions"],
                    ["Liveness check",              "Smile ID",            "< 60s",   "All jurisdictions"],
                    ["Beneficial owner check",      "Smile ID + Manual",   "< 4h",    "100%"],
                    ["FATF enhanced due diligence", "Manual review",       "< 24h",   "NG, KE, AO only"],
                    ["Whitelist write (on-chain)",  "Irofi Transfer Hook", "< 400ms", "Post-KYC"],
                  ].map(([stage, provider, sla, cov]) => (
                    <tr key={stage}>
                      <td style={{ color: "var(--text)" }}>{stage}</td>
                      <td>{provider}</td>
                      <td style={{ color: "var(--teal)" }} className="tabular">{sla}</td>
                      <td>{cov}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="animate-fade-in">
            <AuditLog />
          </div>
        )}

        {tab === "sanctions" && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <span className="card-title">Sanctions Screening — Last 30 Days</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span className="live-dot" />
                <span style={{ fontSize: "0.67rem", color: "var(--text-3)" }}>OFAC · UN · EU · HMT · FATF</span>
              </div>
            </div>
            <table className="data-table">
              <thead><tr><th>Wallet</th><th>List</th><th>Match</th><th>Entity</th><th>Action</th><th>Time</th></tr></thead>
              <tbody>
                {SANCTIONS.map((s) => (
                  <tr key={s.wallet}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{s.wallet}</td>
                    <td><span className="badge badge-red">{s.list}</span></td>
                    <td style={{ color: "var(--text-2)" }}>{s.match}</td>
                    <td style={{ color: "var(--text-3)", fontSize: "0.7rem" }}>{s.entity}</td>
                    <td>{actionBadge(s.action)}</td>
                    <td style={{ color: "var(--text-3)" }}>{s.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "travel-rule" && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <span className="card-title">TRISA Envelope Queue</span>
              <span style={{ fontSize: "0.67rem", color: "var(--text-3)" }}>Protocol: TRISA v3 · IVMS 101 · ISO 20022</span>
            </div>
            <table className="data-table">
              <thead><tr><th>ID</th><th>Originator</th><th>Beneficiary</th><th>Amount</th><th>Corridor</th><th>Status</th><th>Expires</th></tr></thead>
              <tbody>
                {TRAVEL_RULE.map((tr) => (
                  <tr key={tr.id}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--text)", fontSize: "0.72rem" }}>{tr.id}</td>
                    <td style={{ color: "var(--text)" }}>{tr.from}</td>
                    <td>{tr.to}</td>
                    <td style={{ fontWeight: 700, color: "var(--text)" }} className="tabular">{tr.amount}</td>
                    <td><span className="corridor-tag">{tr.corridor}</span></td>
                    <td>{actionBadge(tr.status)}</td>
                    <td style={{ color: tr.expires !== "—" ? "var(--amber)" : "var(--text-3)" }} className="tabular">
                      {tr.expires}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}
