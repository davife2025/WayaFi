"use client";

const EVENTS = [
  { type: "TRANSFER_INITIATED", sub: "txfr_001 — NG_KE — $50,000",     status: "ok",   ts: "09:41:22", meta: null },
  { type: "KYC_CHECK",          sub: "Sender + receiver verified",       status: "ok",   ts: "09:41:23", meta: "Smile ID" },
  { type: "KYT_SCREENING",      sub: "Transaction pattern analysis",     status: "ok",   ts: "09:41:23", meta: "Risk 2.1" },
  { type: "SANCTIONS_SCREEN",   sub: "OFAC · UN · EU · HMT checked",    status: "ok",   ts: "09:41:24", meta: "Clear" },
  { type: "AML_ASSESSMENT",     sub: "Corridor risk score computed",     status: "ok",   ts: "09:41:24", meta: "Score 28" },
  { type: "TRAVEL_RULE",        sub: "TRISA envelope → KCB Kenya",       status: "ok",   ts: "09:41:25", meta: "IVMS 101" },
  { type: "ON_CHAIN_EXECUTE",   sub: "Token-2022 Transfer Hook passed",  status: "ok",   ts: "09:41:26", meta: "Slot 301847291" },
  { type: "SETTLEMENT",         sub: "Off-ramp notified — Yellow Card",  status: "ok",   ts: "09:41:26", meta: "412ms" },
];

const DOT_COLOR: Record<string, string> = {
  ok:      "var(--teal)",
  warn:    "var(--amber)",
  error:   "var(--red)",
};

export function AuditLog() {
  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="card-header">
        <span className="card-title">Compliance Audit Log</span>
        <span style={{ fontSize: "0.67rem", color: "var(--text-3)" }}>
          Immutable · On-chain anchored
        </span>
      </div>

      <div style={{ padding: "0.5rem 0" }}>
        {EVENTS.map((e, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.85rem",
              padding: "0.6rem 1rem",
              borderBottom: i < EVENTS.length - 1 ? "1px solid var(--border)" : "none",
              transition: "background 0.1s",
            }}
            onMouseEnter={el => (el.currentTarget.style.background = "var(--bg-2)")}
            onMouseLeave={el => (el.currentTarget.style.background = "transparent")}
          >
            {/* Timeline dot */}
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: DOT_COLOR[e.status],
              boxShadow: e.status === "ok" ? `0 0 5px ${DOT_COLOR[e.status]}` : "none",
              marginTop: "0.3rem", flexShrink: 0,
            }} />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 700, fontFamily: "var(--font-mono)",
                  color: "var(--text)", letterSpacing: "0.04em",
                }}>
                  {e.type}
                </span>
                {e.meta && (
                  <span className="badge badge-ghost" style={{ fontSize: "0.62rem" }}>{e.meta}</span>
                )}
              </div>
              <p style={{ fontSize: "0.68rem", color: "var(--text-3)", marginTop: "0.1rem" }}>
                {e.sub}
              </p>
            </div>

            {/* Timestamp */}
            <span style={{
              fontSize: "0.65rem", fontFamily: "var(--font-mono)",
              color: "var(--text-3)", flexShrink: 0,
            }}>
              {e.ts}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
