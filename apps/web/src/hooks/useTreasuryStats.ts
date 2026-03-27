import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function useTreasuryStats() {
  return useQuery({
    queryKey: ["treasury-stats"],
    queryFn: async () => {
      const [corridors] = await Promise.all([apiClient.get("/corridors")]);
      const total = (corridors.corridors ?? []).reduce(
        (sum: number, c: any) => sum + (c.total_liquidity_usdc ?? 0), 0
      );
      return { total_liquidity_usdc: total, settled_30d_usdc: 0, pending_count: 0, avg_settlement_seconds: 8 };
    },
  });
}
