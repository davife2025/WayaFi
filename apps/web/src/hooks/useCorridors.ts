import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function useCorridors() {
  return useQuery({
    queryKey: ["corridors"],
    queryFn: () => apiClient.get("/corridors").then((d) => d.corridors),
  });
}
