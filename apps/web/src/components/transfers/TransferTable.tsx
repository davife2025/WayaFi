"use client";
import Link from "next/link";
import { useTransfers } from "@/hooks/useTransfers";
import type { TransferRow } from "@irofi/types";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  completed:   { label: "Settled",      cls: "badge-teal"  },
  held:        { label: "Held",         cls: "badge-amber" },
  failed:      { label: "Failed",       cls: "badge-red"   },
  initiated:   { label: "Initiated",    cls: "badge-ghost" },
  on_chain:    { label: "On-Chain",     cls: "badge-blue"  },
  travel_rule: { label: "Travel Rule",  cls: "badge-sol"   },
  kyc_check:   { label: "KYC Check",   cls: "badge-amber" },
  kyt_check:   { label: "KYT Check",   cls: "badge-amber" },
  settling:    { label: "Settling",     cls: "badge-blue"  },
};

export function TransferTable() {
  const { data, isLoading } = useTransfers();
  const transfers: TransferRow[] = data?.transfers ?? [];

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <span className="card-title">Recent Transfers</span>
        <Link href="/transfer" className="btn btn-primary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.7rem" }}>
          + New Transfer
        </Link>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        {isLoading ? (
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 36, borderRadius: 3 }} />
            ))}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Transfer ID</th>
                <th>Corridor</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Settlement</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem 0", color: "var(--text-3)" }}>
                    No transfers yet — initiate your first settlement
                  </td>
                </tr>
              ) : (
                transfers.map((tx: TransferRow) => {
                  const s = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.initiated;
                  return (
                    <tr key={tx.transfer_id}>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)", fontSize: "0.72rem" }}>
                          {tx.transfer_id.slice(0, 14)}…
                        </span>
                      </td>
                      <td>
                        <span className="corridor-tag">{tx.corridor.replace("_", "→")}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "var(--text)" }} className="tabular">
                          ${tx.amount_usdc.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="tabular">
                        {tx.total_duration_ms
                          ? <span style={{ color: "var(--teal)" }}>{(tx.total_duration_ms / 1000).toFixed(1)}s</span>
                          : <span style={{ color: "var(--text-3)" }}>—</span>
                        }
                      </td>
                      <td style={{ color: "var(--text-3)", fontSize: "0.72rem" }}>
                        {tx.initiated_at ? new Date(tx.initiated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
