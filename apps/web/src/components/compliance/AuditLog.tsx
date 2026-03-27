"use client";

const SAMPLE_EVENTS = [
  { type: "kyt_check",      status: "passed",   transfer: "txfr_001", ts: "09:41:23", risk: 2.1 },
  { type: "sanctions",      status: "clear",    transfer: "txfr_001", ts: "09:41:24", risk: null },
  { type: "aml_assessment", status: "approved", transfer: "txfr_001", ts: "09:41:24", risk: 28 },
  { type: "travel_rule",    status: "accepted", transfer: "txfr_001", ts: "09:41:25", risk: null },
  { type: "on_chain",       status: "confirmed",transfer: "txfr_001", ts: "09:41:26", risk: null },
];

export function AuditLog() {
  return (
    <div className="irofi-card">
      <h2 className="text-lg font-semibold text-white mb-4">Compliance Audit Log</h2>
      <div className="space-y-2">
        {SAMPLE_EVENTS.map((e, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-0">
            <span className={`text-xs px-2 py-0.5 rounded font-mono ${
              e.status === "passed" || e.status === "clear" || e.status === "approved" || e.status === "accepted" || e.status === "confirmed"
                ? "bg-emerald-900/40 text-emerald-400"
                : "bg-amber-900/40 text-amber-400"
            }`}>
              {e.status}
            </span>
            <span className="text-xs text-zinc-400 flex-1">{e.type.replace(/_/g, " ")}</span>
            {e.risk !== null && (
              <span className="text-xs text-zinc-600">risk {e.risk}</span>
            )}
            <span className="text-xs font-mono text-zinc-600">{e.ts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
