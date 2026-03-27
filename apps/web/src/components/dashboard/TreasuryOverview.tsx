"use client";
import { useTreasuryStats } from "@/hooks/useTreasuryStats";

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="irofi-card">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-white" style={accent ? { color: accent } : undefined}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

export function TreasuryOverview() {
  const { data, isLoading } = useTreasuryStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="irofi-card animate-pulse h-24 bg-zinc-800" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Treasury Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Liquidity"
          value={`$${(data?.total_liquidity_usdc ?? 0).toLocaleString()}`}
          sub="USDC across all corridors"
          accent="var(--irofi-green)"
        />
        <StatCard
          label="Settled (30d)"
          value={`$${(data?.settled_30d_usdc ?? 0).toLocaleString()}`}
          sub="Net settled volume"
        />
        <StatCard
          label="Pending"
          value={data?.pending_count?.toString() ?? "0"}
          sub="Transfers in pipeline"
          accent="var(--irofi-amber)"
        />
        <StatCard
          label="Avg Settlement"
          value={`${data?.avg_settlement_seconds ?? 0}s`}
          sub="End-to-end (target < 10s)"
          accent="var(--irofi-green)"
        />
      </div>
    </div>
  );
}
