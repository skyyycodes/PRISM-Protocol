'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Wallet,
  Key,
  LogOut,
  Shield,
  Cpu,
  LineChart,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { icon: Home,      label: 'Dashboard', href: '/dashboard' },
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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="group/sidebar fixed left-0 top-0 z-50 flex h-full w-[72px] hover:w-[240px] flex-col overflow-hidden border-r border-white/[0.05] bg-black/20 py-5 transition-[width] duration-300 ease-out">
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
        <div className="flex items-baseline gap-2 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
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
                  'whitespace-nowrap font-mono text-sm transition-opacity duration-200 opacity-0 group-hover/sidebar:opacity-100',
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
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/30 transition-colors group-hover/item:text-white">
                <Icon className="h-[20px] w-[20px]" strokeWidth={1.5} />
              </div>
              <span className="whitespace-nowrap font-mono text-sm text-white/60 transition-opacity duration-200 opacity-0 group-hover/sidebar:opacity-100 group-hover/item:text-white">
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
