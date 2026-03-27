"use client";
import Link from "next/link";
import { useTransfers } from "@/hooks/useTransfers";

const STATUS_STYLES: Record<string, string> = {
  completed:   "bg-emerald-900/40 text-emerald-400",
  held:        "bg-amber-900/40 text-amber-400",
  failed:      "bg-red-900/40 text-red-400",
  initiated:   "bg-zinc-800 text-zinc-400",
  on_chain:    "bg-blue-900/40 text-blue-400",
  travel_rule: "bg-purple-900/40 text-purple-400",
};

export function TransferTable() {
  const { data, isLoading } = useTransfers();

  return (
    <div className="irofi-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Recent Transfers</h2>
        <Link
          href="/transfer"
          className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
          style={{ background: "var(--irofi-green)", color: "#000" }}
        >
          + New Transfer
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Transfer ID", "Corridor", "Amount", "Status", "Settlement", "Time"].map((h) => (
                  <th key={h} className="text-left text-xs text-zinc-500 uppercase tracking-wider pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {(data?.transfers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">No transfers yet</td>
                </tr>
              ) : (
                (data?.transfers ?? []).map((tx) => (
                  <tr key={tx.transfer_id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-400">{tx.transfer_id.slice(0, 12)}…</td>
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-300">{tx.corridor}</td>
                    <td className="py-3 pr-4 font-semibold text-white">${tx.amount_usdc.toLocaleString()}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[tx.status] ?? STATUS_STYLES.initiated}`}>
                        {tx.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-zinc-500">
                      {tx.total_duration_ms ? `${(tx.total_duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="py-3 text-xs text-zinc-500">
                      {tx.initiated_at ? new Date(tx.initiated_at).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
