"use client";
import { useCorridors } from "@/hooks/useCorridors";
import type { CorridorInfo } from "@irofi/types";

const META: Record<string, { from: string; to: string; fromFlag: string; toFlag: string; fx: string }> = {
  NG_KE: { from: "Nigeria",       to: "Kenya",        fromFlag: "🇳🇬", toFlag: "🇰🇪", fx: "NGN/KES" },
  NG_ZA: { from: "Nigeria",       to: "South Africa", fromFlag: "🇳🇬", toFlag: "🇿🇦", fx: "NGN/ZAR" },
  NG_GH: { from: "Nigeria",       to: "Ghana",        fromFlag: "🇳🇬", toFlag: "🇬🇭", fx: "NGN/GHS" },
  KE_ZA: { from: "Kenya",         to: "South Africa", fromFlag: "🇰🇪", toFlag: "🇿🇦", fx: "KES/ZAR" },
  KE_GH: { from: "Kenya",         to: "Ghana",        fromFlag: "🇰🇪", toFlag: "🇬🇭", fx: "KES/GHS" },
};

function CorridorTile({ corridor }: { corridor: CorridorInfo }) {
  const meta = META[corridor.id];
  if (!meta) return null;

  return (
    <div style={{
      background: "var(--bg-1)",
      border: "1px solid var(--border)",
      borderRadius: 4,
      padding: "1rem",
      cursor: "pointer",
      transition: "border-color 0.15s",
      position: "relative",
      overflow: "hidden",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-2)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.67rem", fontWeight: 700,
          letterSpacing: "0.08em", color: "var(--text-3)",
          background: "var(--bg-3)", padding: "0.15rem 0.45rem", borderRadius: 2,
        }}>
          {corridor.id.replace("_", "/")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          {corridor.fatf_grey_listed && (
            <span className="badge badge-amber" style={{ fontSize: "0.6rem" }}>FATF</span>
          )}
          <span className="live-dot" />
        </div>
      </div>

      {/* Route */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: "1.3rem", lineHeight: 1 }}>{meta.fromFlag}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-3)", marginTop: "0.25rem", letterSpacing: "0.04em" }}>
            {meta.from.toUpperCase()}
          </div>
        </div>

        <div style={{ flex: 2, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" }}>
          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 0 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border-2)" }} />
            <div style={{
              padding: "0.15rem 0.45rem",
              background: "var(--teal)", color: "var(--bg)",
              borderRadius: 2, fontSize: "0.6rem", fontWeight: 800,
              letterSpacing: "0.04em", flexShrink: 0,
            }}>
              USDC
            </div>
            <div style={{ flex: 1, height: 1, background: "var(--border-2)" }} />
          </div>
          <span style={{ fontSize: "0.62rem", color: "var(--text-3)" }}>{meta.fx}</span>
        </div>

        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: "1.3rem", lineHeight: 1 }}>{meta.toFlag}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--text-3)", marginTop: "0.25rem", letterSpacing: "0.04em" }}>
            {meta.to.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: "0.65rem", color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Liquidity</span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--teal)", fontFamily: "var(--font-mono)" }} className="tabular">
            ${(corridor.total_liquidity_usdc ?? 0).toLocaleString()}
          </span>
        </div>
        {corridor.fatf_grey_listed && (
          <div style={{
            marginTop: "0.6rem", padding: "0.4rem 0.6rem",
            background: "var(--amber-dim)", border: "1px solid rgba(240,165,0,0.12)",
            borderRadius: 2,
          }}>
            <p style={{ fontSize: "0.65rem", color: "var(--amber)", fontWeight: 600 }}>
              Enhanced Due Diligence
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function CorridorCards() {
  const { data: corridors, isLoading } = useCorridors();

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "0.75rem",
      }}>
        <span style={{
          fontSize: "0.67rem", fontWeight: 600, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--text-3)",
        }}>
          Active Corridors
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span className="live-dot" />
          <span style={{ fontSize: "0.67rem", color: "var(--text-3)" }}>Pyth · SIX FX</span>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "0.75rem",
      }}>
        {isLoading
          ? [...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 160, borderRadius: 4 }} />
            ))
          : (corridors ?? []).map((corridor: CorridorInfo) => (
              <CorridorTile key={corridor.id} corridor={corridor} />
            ))}
      </div>
    </div>
  );
}
