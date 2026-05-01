"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { ConnectWalletButton } from "./connect-wallet-button";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tranches", href: "/deposit" },
  { label: "Markets", href: "/trade" },
  { label: "Analytics", href: "/analytics" },
  { label: "Docs", href: "/" },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <nav aria-label="Primary" className="mx-auto max-w-[1400px]">
        <div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            aria-label="PRISM Protocol home"
            className="group flex min-w-0 items-center gap-2 sm:gap-3"
          >
            <span className="relative h-11 w-11 shrink-0 overflow-hidden">
              <Image
                src="/logos/prism.png"
                alt="PRISM logo"
                width={240}
                height={160}
                priority
                className="absolute left-1/2 top-[54%] h-36 w-[13.5rem] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
              />
            </span>
            <span className="font-display text-2xl tracking-tight text-white">
              PRISM
            </span>
            <span className="mt-1 hidden font-mono text-xs leading-4 text-white/60 sm:inline">
              PROTOCOL
            </span>
            <span className="ml-2 hidden rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-purple-300 sm:inline">
              Devnet
            </span>
          </Link>

          <div className="hidden items-center gap-10 md:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "group relative text-sm font-medium transition-colors",
                    active ? "text-white" : "text-white/70 hover:text-white",
                  ].join(" ")}
                >
                  {link.label}
                  <span
                    className={[
                      "absolute -bottom-1 left-0 h-px bg-white transition-all",
                      active ? "w-full" : "w-0 group-hover:w-full",
                    ].join(" ")}
                  />
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hidden items-center gap-2 rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white md:inline-flex"
              aria-label="Switch vault"
            >
              <span className="font-mono">Vault 0</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            <ConnectWalletButton />

            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              aria-label="Toggle menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div
          className={[
            "mx-4 overflow-hidden rounded-lg border border-white/10 bg-black/95 shadow-2xl backdrop-blur transition-all duration-300 md:hidden",
            mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 border-transparent opacity-0",
          ].join(" ")}
        >
          <div className="grid gap-1 p-2">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={[
                    "rounded-md px-3 py-3 text-sm transition-colors",
                    active ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
}
