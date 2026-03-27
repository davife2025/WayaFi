"use client";
import { Navbar } from "@/components/ui/Navbar";
import { CompliancePanel } from "@/components/compliance/CompliancePanel";
import { AuditLog } from "@/components/compliance/AuditLog";

export default function CompliancePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Compliance Dashboard</h1>
          <p className="text-zinc-400 mt-1">KYC status, AML risk scores, Travel Rule records</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div><CompliancePanel /></div>
          <div className="xl:col-span-2"><AuditLog /></div>
        </div>
      </main>
    </div>
  );
}
