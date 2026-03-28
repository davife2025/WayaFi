"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";

const NAV = [
  { href: "/",           label: "Treasury"   },
  { href: "/transfer",   label: "Transfer"   },
  { href: "/compliance", label: "Compliance" },
];

// Simulated live SOL block time — replace with real RPC call
const BLOCK_TIME = "412ms";
const SLOT = "301,847,291";

export function Navbar() {
  const pathname = usePathname();
  const { connected, publicKey } = useWallet();

  return (
    <header className="topbar">
      {/* Logo */}
      <div className="topbar-logo">
        IRO<span>FI</span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "var(--border-2)", marginRight: "1.5rem" }} />

      {/* Nav links */}
      <nav className="topbar-nav">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`topbar-nav-item ${pathname === item.href ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Right side */}
      <div className="topbar-right">
        {/* Network indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.25rem 0.6rem",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 3,
        }}>
          <span className="live-dot" />
          <span style={{ fontSize: "0.67rem", color: "var(--text-3)", letterSpacing: "0.05em" }}>
            SOL
          </span>
          <span style={{ fontSize: "0.67rem", color: "var(--teal)", fontWeight: 600 }}>
            {BLOCK_TIME}
          </span>
          <span style={{ width: 1, height: 12, background: "var(--border)", display: "inline-block" }} />
          <span style={{ fontSize: "0.67rem", color: "var(--text-3)" }}>
            #{SLOT}
          </span>
        </div>

        {/* Wallet button */}
        <WalletMultiButton />
      </div>
    </header>
  );
}