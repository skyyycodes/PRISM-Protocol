"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ChevronDown, Copy, ExternalLink, LogOut, Wallet } from "lucide-react";

function shortAddress(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { publicKey, wallet, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 text-sm font-semibold text-pink-300 transition-colors hover:bg-pink-500/20 md:h-12 md:w-auto md:px-7"
        aria-label="Connect wallet"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden md:inline">Connect Wallet</span>
      </button>
    );
  }

  const address = publicKey.toBase58();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 text-sm font-semibold text-pink-200 transition-colors hover:bg-pink-500/20 md:h-12 md:w-auto md:px-5"
        aria-label="Wallet menu"
      >
        {wallet?.adapter.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" className="h-4 w-4" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        <span className="hidden font-mono text-xs md:inline">{shortAddress(address)}</span>
        <ChevronDown
          className={[
            "hidden h-3.5 w-3.5 transition-transform md:block",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-white/10 bg-black/95 shadow-2xl backdrop-blur">
          <div className="border-b border-white/10 px-3 py-2 text-[11px] text-white/50">
            Connected via {wallet?.adapter.name ?? "wallet"}
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(address);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy address
          </button>
          <a
            href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Explorer
          </a>
          <button
            type="button"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-sm text-pink-300 transition-colors hover:bg-pink-500/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
