"use client";
import { TreasuryOverview } from "@/components/dashboard/TreasuryOverview";
import { CorridorCards } from "@/components/dashboard/CorridorCards";
import { TransferTable } from "@/components/transfers/TransferTable";
import { CompliancePanel } from "@/components/compliance/CompliancePanel";
import { Navbar } from "@/components/ui/Navbar";
import { useWallet } from "@solana/wallet-adapter-react";

export default function DashboardPage() {
  const { connected } = useWallet();
  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">IroFi</h1>
          <p className="text-zinc-400 text-lg mb-8">Institutional cross-border treasury rails for Africa</p>
          <p className="text-zinc-500 text-sm">Connect your wallet to access the dashboard</p>
        </div>
        <Navbar />
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <TreasuryOverview />
        <CorridorCards />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2"><TransferTable /></div>
          <div><CompliancePanel /></div>
        </div>
      </main>
    </div>
  );
}
