"use client";
import { useComplianceStatus } from "@/hooks/useComplianceStatus";

function Row({
  label, value, accent,
}: {
  label: string;
  value: string;
  accent: "teal" | "amber" | "red" | "neutral";
}) {
  const colors = {
    teal:    "var(--teal)",
    amber:   "var(--amber)",
    red:     "var(--red)",
    neutral: "var(--text-2)",
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0.5rem 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{label}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: colors[accent], fontFamily: "var(--font-mono)" }}>
        {value}
      </span>
    </div>
  );
}

export function CompliancePanel() {
  const { data } = useComplianceStatus();

  const score = data?.aml_risk_score ?? 28;
  const scoreColor = score <= 30 ? "var(--teal)" : score <= 60 ? "var(--amber)" : "var(--red)";
  const scoreLabel = score <= 30 ? "LOW" : score <= 60 ? "MEDIUM" : "HIGH";

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="card-header">
        <span className="card-title">Compliance Status</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span className="live-dot" />
          <span style={{ fontSize: "0.67rem", color: "var(--text-3)" }}>Live</span>
        </div>
      </div>

      <div style={{ padding: "1rem" }}>
        {/* AML Score gauge */}
        <div style={{
          background: "var(--bg-2)", border: "1px solid var(--border)",
          borderRadius: 3, padding: "0.85rem", marginBottom: "0.75rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)" }}>
              AML Risk Score
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: scoreColor }}>
              {score}/100 · {scoreLabel}
            </span>
          </div>
          {/* Score bar */}
          <div style={{ height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${score}%`,
              background: scoreColor,
              boxShadow: `0 0 8px ${scoreColor}`,
              borderRadius: 2,
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Status rows */}
        <div>
          <Row label="KYC Status"     value={(data?.kyc_status ?? "verified").toUpperCase()}      accent="teal" />
          <Row label="KYC Expires"    value={data?.kyc_expires ?? "180 days"}                     accent="neutral" />
          <Row label="Sanctions"      value={data?.sanctions_clear ? "CLEAR" : "REVIEW"}          accent={data?.sanctions_clear ? "teal" : "red"} />
          <Row label="Travel Rule"    value={(data?.travel_rule_state ?? "Active").toUpperCase()}  accent="teal" />
          <Row
            label="FATF Grey List"
            value={data?.fatf_grey_listed ? "YES — EDD ACTIVE" : "NOT LISTED"}
            accent={data?.fatf_grey_listed ? "amber" : "teal"}
          />
        </div>

        {/* FATF note */}
        {data?.fatf_grey_listed && (
          <div style={{
            marginTop: "0.75rem", padding: "0.6rem 0.75rem",
            background: "var(--amber-dim)", border: "1px solid rgba(240,165,0,0.15)",
            borderRadius: 3,
          }}>
            <p style={{ fontSize: "0.67rem", color: "var(--amber)", fontWeight: 600, marginBottom: "0.2rem" }}>
              Enhanced Due Diligence Active
            </p>
            <p style={{ fontSize: "0.67rem", color: "var(--text-3)", lineHeight: 1.5 }}>
              Risk threshold tightened to ≤40. KYC validity reduced to 180 days.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
