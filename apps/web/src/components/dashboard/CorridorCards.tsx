"use client";
import { useCorridors } from "@/hooks/useCorridors";
import type { CorridorInfo } from "@irofi/types";

const CORRIDOR_LABELS: Record<string, { from: string; to: string }> = {
  NG_KE: { from: "Nigeria 🇳🇬", to: "Kenya 🇰🇪" },
  NG_ZA: { from: "Nigeria 🇳🇬", to: "South Africa 🇿🇦" },
  NG_GH: { from: "Nigeria 🇳🇬", to: "Ghana 🇬🇭" },
  KE_ZA: { from: "Kenya 🇰🇪",   to: "South Africa 🇿🇦" },
  KE_GH: { from: "Kenya 🇰🇪",   to: "Ghana 🇬🇭" },
};

// ❌ DELETE the local Corridor interface — CorridorInfo from @irofi/types replaces it

export function CorridorCards() {
  const { data: corridors, isLoading } = useCorridors();

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Active Corridors</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {isLoading
          ? [...Array(5)].map((_, i) => <div key={i} className="irofi-card animate-pulse h-32 bg-zinc-800" />)
          : (corridors ?? []).map((corridor: CorridorInfo) => {
              const label = CORRIDOR_LABELS[corridor.id];
              return (
                <div key={corridor.id} className="irofi-card hover:border-zinc-500 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-zinc-500">{corridor.id}</span>
                    <span className="status-dot green" />
                  </div>
                  <p className="text-xs text-zinc-400">{label?.from}</p>
                  <p className="text-xs text-zinc-500 mb-2">↓</p>
                  <p className="text-xs text-zinc-400">{label?.to}</p>
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <p className="text-sm font-semibold text-white">
                      ${(corridor.total_liquidity_usdc ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-500">liquidity</p>
                  </div>
                  {corridor.fatf_grey_listed && (
                    <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400">
                      FATF Grey List
                    </span>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}