import { useQuery } from "@tanstack/react-query";

export function useComplianceStatus() {
  return useQuery({
    queryKey: ["compliance-status"],
    queryFn: async () => ({
      kyc_status: "verified",
      kyc_expires: "180 days",
      aml_risk_score: 28,
      sanctions_clear: true,
      travel_rule_state: "Active",
      fatf_grey_listed: true,
    }),
  });
}
