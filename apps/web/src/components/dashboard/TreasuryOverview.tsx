"use client";
import { useTreasuryStats } from "@/hooks/useTreasuryStats";

const TILES = [
  {
    key: "total_liquidity_usdc" as const,
    label: "Total Liquidity",
    format: (v: number) => `$${v.toLocaleString()}`,
    sub: "USDC deployed",
    accent: "teal",
  },
  {
    key: "settled_30d_usdc" as const,
    label: "Settled (30d)",
    format: (v: number) => `$${v.toLocaleString()}`,
    sub: "Net volume",
    accent: "teal",
  },
  {
    key: "pending_count" as const,
    label: "Pending",
    format: (v: number) => v.toString(),
    sub: "In pipeline",
    accent: "amber",
  },
  {
    key: "avg_settlement_seconds" as const,
    label: "Avg Settlement",
    format: (v: number) => `${v}s`,
    sub: "Target < 10s",
    accent: "teal",
  },
];

export function TreasuryOverview() {
  const { data, isLoading } = useTreasuryStats();

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 88, borderRadius: 4 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
      {TILES.map((tile) => {
        const raw = (data as any)?.[tile.key] ?? 0;
        return (
          <div key={tile.key} className="stat-tile">
            <div className="stat-label">{tile.label}</div>
            <div
              className="stat-value tabular"
              style={{ color: tile.accent === "amber" ? "var(--amber)" : "var(--text)" }}
            >
              {tile.format(raw)}
            </div>
            <div className={`stat-delta ${tile.accent === "amber" ? "neu" : ""}`}>
              {tile.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}
