"use client";
import { useComplianceStatus } from "@/hooks/useComplianceStatus";

export function CompliancePanel() {
  const { data } = useComplianceStatus();

  const items = [
    { label: "KYC Status",       value: data?.kyc_status ?? "verified",   accent: "green" },
    { label: "KYC Expires",      value: data?.kyc_expires ?? "180 days",  accent: "neutral" },
    { label: "AML Risk Score",   value: `${data?.aml_risk_score ?? 28}/100`, accent: "green" },
    { label: "Sanctions",        value: data?.sanctions_clear ? "Clear" : "Review", accent: data?.sanctions_clear ? "green" : "red" },
    { label: "Travel Rule",      value: data?.travel_rule_state ?? "Active", accent: "green" },
    { label: "FATF Grey List",   value: data?.fatf_grey_listed ? "Yes — Enhanced DD" : "No", accent: data?.fatf_grey_listed ? "amber" : "neutral" },
  ];

  return (
    <div className="irofi-card">
      <h2 className="text-lg font-semibold text-white mb-4">Compliance Status</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{item.label}</span>
            <span className={`text-xs font-medium ${
              item.accent === "green" ? "text-emerald-400" :
              item.accent === "amber" ? "text-amber-400" :
              item.accent === "red"   ? "text-red-400" : "text-zinc-300"
            }`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
