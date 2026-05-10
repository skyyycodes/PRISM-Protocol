'use client';

import { Search, Bell } from 'lucide-react';
import { ConnectWalletButton } from './connect-wallet-button';
import { TestnetFaucetButton } from './testnet-faucet-button';

export function ContentHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-white/[0.05] bg-transparent px-8">
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
        <input 
          type="text" 
          placeholder="Type to search..." 
          className="h-9 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 font-mono text-[11px] text-white placeholder-white/20 focus:border-white/20 focus:outline-none focus:ring-0"
        />
      </div>

      <div className="flex items-center gap-4">
        <TestnetFaucetButton />
        <ConnectWalletButton />
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 hover:text-white transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-pink-500" />
        </button>
      </div>
    </header>
  );
}
