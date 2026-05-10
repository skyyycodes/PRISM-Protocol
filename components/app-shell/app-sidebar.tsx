'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Wallet,
  User,
  BarChart3,
  Key,
  HelpCircle,
  LogOut,
  Shield,
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Wallet, label: 'Market', href: '/earn' },
  { icon: User, label: 'Identity', href: '/protect' },
  { icon: BarChart3, label: 'Analytics', href: '/trade' },
  { icon: Key, label: 'Borrow', href: '/borrower' },
];

const BOTTOM_ITEMS = [
  { icon: Shield,     label: 'Admin',  href: '/admin' },
  { icon: HelpCircle, label: 'Help',   href: '/docs'  },
  { icon: LogOut,     label: 'Logout', href: '/'      },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-[72px] flex-col items-center border-r border-white/[0.08] bg-[#070707] py-6">
      {/* Logo */}
      <Link href="/dashboard" className="mb-10 flex h-10 w-10 items-center justify-center">
        <Image 
          src="/icon-dark-64x64.png"
          alt="PRISM"
          width={32}
          height={32}
          className="h-8 w-8 object-contain"
        />
      </Link>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-6">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex h-10 w-10 items-center justify-center transition-all duration-300 ${
                isActive 
                  ? 'bg-white text-black rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                  : 'text-white/20 hover:text-white'
              }`}
              title={item.label}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-4">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex h-12 w-12 items-center justify-center text-white/30 transition-all duration-300 hover:text-white"
              title={item.label}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
