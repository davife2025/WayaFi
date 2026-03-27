"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const NAV = [
  { href: "/",           label: "Dashboard" },
  { href: "/transfer",   label: "New Transfer" },
  { href: "/compliance", label: "Compliance" },
  { href: "/corridors",  label: "Corridors" },
];

export function Navbar() {
  const path = usePathname();
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-xl tracking-tight" style={{ color: "var(--irofi-green)" }}>
            IroFi
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  path === n.href
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <WalletMultiButton style={{ background: "#00D4A8", color: "#000", fontWeight: 600, borderRadius: 8, fontSize: 14 }} />
      </div>
    </nav>
  );
}
