"use client";
import { Navbar } from "@/components/ui/Navbar";
import { TransferForm } from "@/components/transfers/TransferForm";

export default function TransferPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">New Transfer</h1>
          <p className="text-zinc-400 mt-1">Initiate a compliant cross-border USDC settlement</p>
        </div>
        <TransferForm />
      </main>
    </div>
  );
}
