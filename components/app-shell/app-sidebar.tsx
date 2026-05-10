'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  Home,
  Wallet,
  Key,
  LogOut,
  Shield,
  Cpu,
  LineChart,
  BookOpen,
  Briefcase,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { icon: Home,      label: 'Dashboard', href: '/dashboard' },
  { icon: Briefcase, label: 'Positions', href: '/positions' },
  { icon: Wallet,    label: 'Earn',      href: '/earn'      },
  { icon: LineChart, label: 'Trade',     href: '/trade'     },
  { icon: Cpu,       label: 'Terminal',  href: '/terminal'  },
  { icon: Key,       label: 'Borrow',    href: '/borrow'    },
];

const BOTTOM_ITEMS = [
  { icon: Shield,   label: 'Admin',   href: '/admin', external: false },
  { icon: BookOpen, label: 'Docs',    href: 'https://docs.prismprotocol.dev', external: true },
  { icon: LogOut,   label: 'Log out', href: '/', external: false },
];

function shortAddress(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// ─── Sidebar Wallet Button ────────────────────────────────────────────────────

function SidebarWalletButton({
  walletOpen,
  setWalletOpen,
}: {
  walletOpen: boolean;
  setWalletOpen: (v: boolean) => void;
}) {
  const { publicKey, wallet, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number }>({ left: 248, bottom: 0 });

  // Keep dropdown anchored to sidebar's right edge (sidebar is forced expanded while open)
  useEffect(() => {
    if (!walletOpen || !buttonRef.current) return;
    const update = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      setPos({
        left: rect.right + 8,
        bottom: window.innerHeight - rect.bottom,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [walletOpen]);

  useEffect(() => {
    if (!walletOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setWalletOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [walletOpen, setWalletOpen]);

  const handleClick = () => {
    if (connected) setWalletOpen(!walletOpen);
    else setVisible(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className="group/item flex w-full items-center gap-3 h-11 pl-4 pr-3"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-pink-500/40 bg-pink-500/[0.18] text-pink-200 shadow-[0_0_15px_rgba(236,72,153,0.18)] transition-colors group-hover/item:bg-pink-500/[0.28]">
          {connected && wallet?.adapter.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wallet.adapter.icon} alt="" className="h-[18px] w-[18px]" />
          ) : (
            <Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} />
          )}
        </div>
        <span className="whitespace-nowrap font-mono text-sm text-pink-200/90 transition-opacity duration-200 opacity-0 group-hover/sidebar:opacity-100">
          {connected && publicKey ? shortAddress(publicKey.toBase58()) : 'Connect Wallet'}
        </span>
      </button>

      {walletOpen && connected && publicKey && (
        <div
          ref={dropdownRef}
          style={{ left: pos.left, bottom: pos.bottom }}
          className="fixed w-56 overflow-hidden rounded-md border border-white/10 bg-black/95 shadow-2xl backdrop-blur z-[60]"
        >
          <div className="border-b border-white/10 px-3 py-2 text-[11px] text-white/50">
            Connected via {wallet?.adapter.name ?? 'wallet'}
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(publicKey.toBase58());
              setWalletOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy address
          </button>
          <a
            href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setWalletOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Explorer
          </a>
          <button
            type="button"
            onClick={() => {
              disconnect();
              setWalletOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-sm text-pink-300 transition-colors hover:bg-pink-500/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </div>
      )}
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname();
  const [walletOpen, setWalletOpen] = useState(false);

  // While wallet menu is open, keep sidebar expanded.
  // When it closes, sidebar reverts to hover-driven width.
  return (
    <aside
      className={cn(
        'group/sidebar fixed left-0 top-0 z-50 flex h-full flex-col overflow-hidden border-r border-white/[0.05] py-5 transition-all duration-300 ease-out',
        walletOpen
          ? 'w-[240px] bg-black/55'
          : 'w-[72px] hover:w-[240px] bg-black/20 hover:bg-black/55',
      )}
    >
      {/* Logo + Title */}
      <Link href="/dashboard" className="mb-8 flex items-center gap-3 pl-[14px] pr-3">
        <span className="relative h-11 w-11 shrink-0">
          <Image
            src="/icon-dark-64x64.png"
            alt="PRISM"
            fill
            className="object-contain"
          />
        </span>
        <div
          className={cn(
            'flex items-baseline gap-2 whitespace-nowrap transition-opacity duration-200',
            walletOpen ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100',
          )}
        >
          <span className="font-display text-xl leading-none tracking-tight text-white">PRISM</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">Protocol</span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group/item flex items-center gap-3 h-11 pl-4 pr-3"
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                  isActive
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                    : 'text-white/30 group-hover/item:text-white',
                )}
              >
                <Icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2 : 1.5} />
              </div>
              <span
                className={cn(
                  'whitespace-nowrap font-mono text-sm transition-opacity duration-200',
                  walletOpen ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100',
                  isActive ? 'text-white font-semibold' : 'text-white/60 group-hover/item:text-white',
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-1.5">
        <SidebarWalletButton walletOpen={walletOpen} setWalletOpen={setWalletOpen} />

        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/30 transition-colors group-hover/item:text-white">
                <Icon className="h-[20px] w-[20px]" strokeWidth={1.5} />
              </div>
              <span
                className={cn(
                  'whitespace-nowrap font-mono text-sm text-white/60 transition-opacity duration-200 group-hover/item:text-white',
                  walletOpen ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100',
                )}
              >
                {item.label}
              </span>
            </>
          );
          const className = "group/item flex items-center gap-3 h-11 pl-4 pr-3";

          return item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className={className}
            >
              {content}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
