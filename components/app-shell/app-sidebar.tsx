"use client";

import {
  Activity,
  Building2,
  Code2,
  Cpu,
  FileText,
  Layers3,
  ScrollText,
  Settings2,
  Sparkles,
  Tag,
  UserCircle,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { FilterSection } from "./filter-section";
import { SidebarRange } from "./sidebar-range";

export function AppSidebar() {
  return (
    <aside
      aria-label="Filters"
      className="relative z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-white/10 bg-transparent lg:flex"
    >
      <div className="h-full overflow-y-auto px-4 py-2 [overscroll-behavior:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterSection title="Vault" icon={Wallet} defaultOpen>
          <ul className="space-y-2 text-xs text-white/70">
            <li className="flex items-center justify-between font-mono">
              <span>Vault 0</span>
              <span className="text-emerald-400">Active</span>
            </li>
            <li className="flex items-center justify-between text-white/45">
              <span>TVL</span>
              <span className="font-mono">19,500 USDC</span>
            </li>
            <li className="flex items-center justify-between text-white/45">
              <span>State</span>
              <span className="font-mono uppercase">Accruing</span>
            </li>
          </ul>
        </FilterSection>

        <FilterSection title="Tranches" icon={Layers3} defaultOpen>
          <div className="space-y-2 text-xs">
            {[
              { label: "Prime", color: "#7DA9FF" },
              { label: "Core", color: "#FFB200" },
              { label: "Alpha", color: "#FF5577" },
            ].map((t) => (
              <label
                key={t.label}
                className="flex cursor-pointer items-center gap-2 text-white/70"
              >
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-3.5 w-3.5 accent-white"
                />
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: t.color }}
                />
                {t.label}
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Strategy Presets" icon={Zap}>
          <div className="space-y-2 text-xs text-white/70">
            {["Safe", "Balanced", "Aggressive", "Custom"].map((preset) => (
              <label key={preset} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="strategy"
                  className="h-3.5 w-3.5 accent-white"
                />
                {preset}
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="NAV Range" icon={Activity} defaultOpen>
          <SidebarRange
            min={0}
            max={150}
            defaultValue={150}
            leftLabel="0.00"
            rightLabel="1.50"
            ariaLabel="NAV range"
          />
        </FilterSection>

        <FilterSection title="Expected APY" icon={Sparkles} defaultOpen>
          <SidebarRange
            min={0}
            max={30}
            defaultValue={15}
            leftLabel="0%"
            rightLabel="30%"
            ariaLabel="Expected APY"
            format={(v) => `${v}%`}
          />
        </FilterSection>

        <FilterSection title="Pool Depth" icon={Tag}>
          <SidebarRange
            min={0}
            max={50000}
            defaultValue={50000}
            leftLabel="0"
            rightLabel="$50K"
            ariaLabel="Pool depth"
            format={(v) => `$${v.toLocaleString()}`}
          />
        </FilterSection>

        <FilterSection title="My Positions" icon={UserCircle}>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
            <input type="checkbox" className="h-3.5 w-3.5 accent-white" />
            Show only mine
          </label>
        </FilterSection>

        <FilterSection title="Event Filter" icon={ScrollText}>
          <div className="space-y-2 text-xs text-white/70">
            {["Deposit", "Yield", "Trade", "Default"].map((e) => (
              <label key={e} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-3.5 w-3.5 accent-white"
                />
                {e}
              </label>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Supported Parameters" icon={Code2}>
          <p className="text-xs text-white/45">No parameters yet.</p>
        </FilterSection>

        <FilterSection title="Providers" icon={Building2}>
          <p className="text-xs text-white/45">No providers registered.</p>
        </FilterSection>

        <FilterSection title="Admin" icon={Wrench}>
          <div className="space-y-2 text-xs">
            <button className="w-full rounded-md border border-white/10 px-3 py-1.5 text-left text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              Trigger Yield
            </button>
            <button className="w-full rounded-md border border-white/10 px-3 py-1.5 text-left text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              Trigger Default
            </button>
            <button className="w-full rounded-md border border-white/10 px-3 py-1.5 text-left text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              Run Market Reaction
            </button>
          </div>
        </FilterSection>

        <FilterSection title="Model Authors" icon={Settings2}>
          <p className="text-xs text-white/45">N/A in PRISM context.</p>
        </FilterSection>

        <FilterSection title="Distillable" icon={FileText}>
          <p className="text-xs text-white/45">N/A in PRISM context.</p>
        </FilterSection>

        <FilterSection title="Categories" icon={Cpu}>
          <p className="text-xs text-white/45">No categories yet.</p>
        </FilterSection>

        <div className="py-4 pb-6">
          <button
            type="button"
            className="w-full rounded-md border border-white/10 bg-transparent py-2 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            Reset all filters
          </button>
        </div>
      </div>
    </aside>
  );
}
