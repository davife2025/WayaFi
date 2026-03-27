import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function useTransfers(page = 1) {
  return useQuery({
    queryKey: ["transfers", page],
    queryFn: () => apiClient.get(`/transfers?page=${page}&limit=20`),
  });
}
