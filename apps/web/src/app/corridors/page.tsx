"use client";
import { Navbar } from "@/components/ui/Navbar";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

const CORRIDOR_META: Record<string, { from: string; to: string; fromFlag: string; toFlag: string; fx: string }> = {
  NG_KE: { from: "Nigeria",       to: "Kenya",        fromFlag: "🇳🇬", toFlag: "🇰🇪", fx: "NGN/KES" },
  NG_ZA: { from: "Nigeria",       to: "South Africa", fromFlag: "🇳🇬", toFlag: "🇿🇦", fx: "NGN/ZAR" },
  NG_GH: { from: "Nigeria",       to: "Ghana",        fromFlag: "🇳🇬", toFlag: "🇬🇭", fx: "NGN/GHS" },
  KE_ZA: { from: "Kenya",         to: "South Africa", fromFlag: "🇰🇪", toFlag: "🇿🇦", fx: "KES/ZAR" },
  KE_GH: { from: "Kenya",         to: "Ghana",        fromFlag: "🇰🇪", toFlag: "🇬🇭", fx: "KES/GHS" },
};

function DataRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "0.45rem 0", borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{label}</span>
      <span style={{
        fontSize: "0.72rem", fontFamily: "var(--font-mono)", fontWeight: 600,
        color: accent ? "var(--teal)" : "var(--text-2)",
      }} className="tabular">
        {value}
      </span>
    </div>
  );
}

function CorridorCard({ corridor }: { corridor: any }) {
  const meta = CORRIDOR_META[corridor.id];
  if (!meta) return null;

  return (
    <div className="card">
      {/* Card header */}
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{meta.fromFlag}</span>
          <span style={{ color: "var(--text-3)", fontSize: "0.75rem" }}>→</span>
          <span style={{ fontSize: "1.1rem" }}>{meta.toFlag}</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "0.67rem", fontWeight: 700,
            letterSpacing: "0.08em", color: "var(--text-2)",
          }}>
            {corridor.id.replace("_", "/")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          {corridor.fatf_grey_listed && <span className="badge badge-amber">FATF</span>}
          <span className="live-dot" />
        </div>
      </div>

      <div className="card-body">
        {/* Route visual */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.75rem", background: "var(--bg-2)", borderRadius: 3,
          border: "1px solid var(--border)", marginBottom: "1rem",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem" }}>{meta.fromFlag}</div>
            <div style={{ fontSize: "0.67rem", color: "var(--text-3)", marginTop: "0.2rem" }}>{meta.from}</div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
            <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 0 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border-2)" }} />
              <span style={{
                padding: "0.2rem 0.6rem", background: "var(--teal)", color: "var(--bg)",
                borderRadius: 2, fontSize: "0.65rem", fontWeight: 800, flexShrink: 0,
              }}>USDC</span>
              <div style={{ flex: 1, height: 1, background: "var(--border-2)" }} />
            </div>
            <span style={{ fontSize: "0.65rem", color: "var(--text-3)" }}>{meta.fx}</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem" }}>{meta.toFlag}</div>
            <div style={{ fontSize: "0.67rem", color: "var(--text-3)", marginTop: "0.2rem" }}>{meta.to}</div>
          </div>
        </div>

        {/* Stats */}
        <DataRow label="Available Liquidity"   value={`$${(corridor.total_liquidity_usdc ?? 0).toLocaleString()} USDC`} accent />
        <DataRow label="Transfer Fee"          value={`${corridor.transfer_fee_bps ?? 50}bps (${((corridor.transfer_fee_bps ?? 50) / 100).toFixed(2)}%)`} />
        <DataRow label="Min Transfer"          value={`$${(corridor.min_transfer_usdc ?? 100).toLocaleString()}`} />
        <DataRow label="Max Transfer"          value={`$${(corridor.max_transfer_usdc ?? 500_000).toLocaleString()}`} />
        <DataRow label="Avg Settlement"        value={`${corridor.avg_settlement_seconds ?? 8}s`} accent />
        <DataRow label="Pending Settlements"   value={`$${(corridor.pending_settlements_usdc ?? 0).toLocaleString()}`} />

        {corridor.fatf_grey_listed && (
          <div style={{
            marginTop: "0.75rem", padding: "0.65rem 0.75rem",
            background: "var(--amber-dim)", border: "1px solid rgba(240,165,0,0.15)",
            borderRadius: 3,
          }}>
            <p style={{ fontSize: "0.67rem", color: "var(--amber)", fontWeight: 700, marginBottom: "0.2rem" }}>
              Enhanced Due Diligence Required
            </p>
            <p style={{ fontSize: "0.67rem", color: "var(--text-3)", lineHeight: 1.5 }}>
              Corridor involves FATF grey-listed jurisdictions. Risk threshold ≤40. KYC validity 180 days.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CorridorsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["corridors"],
    queryFn:  () => apiClient.get("/corridors").then((d) => d.corridors),
  });

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
              Treasury · Corridors
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", letterSpacing: "-0.03em", color: "var(--text)" }}>
              Settlement Corridors
            </h1>
            <p style={{ fontSize: "0.77rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
              Liquidity · Fees · Compliance status · FATF classification
            </p>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Active Corridors", value: "5", accent: true  },
            { label: "Total Liquidity",  value: `$${((data ?? []) as any[]).reduce((s, c) => s + (c.total_liquidity_usdc ?? 0), 0).toLocaleString()} USDC`, accent: true },
            { label: "Avg Settlement",   value: "8s", accent: true },
          ].map((s) => (
            <div key={s.label} className="stat-tile">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value tabular">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 320, borderRadius: 4 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {(data ?? []).map((corridor: any) => (
              <CorridorCard key={corridor.id} corridor={corridor} />
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
