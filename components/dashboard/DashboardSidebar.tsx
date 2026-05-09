'use client';

import { 
  ShieldCheck, 
  Zap, 
  Lightbulb, 
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  Target
} from 'lucide-react';

interface DashboardSidebarProps {
  exposure: Array<{ label: string; value: number; color: string }>;
  insights: Array<{ text: string; type: 'info' | 'warning' | 'alert' }>;
}

export function DashboardSidebar({ exposure = [], insights = [] }: DashboardSidebarProps) {
  return (
    <aside className="space-y-1">
      {/* Unified Intelligence Container */}
      <div className="rounded-sm border border-white/[0.08] bg-[#080808] divide-y divide-white/[0.04]">
        
        {/* Section 1: Portfolio Concentration */}
        <section className="p-6">
          <div className="flex items-center gap-2.5 mb-6">
            <Target className="h-3.5 w-3.5 text-white/40" />
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">Risk Distribution</h2>
          </div>
          
          <div className="space-y-5">
            {exposure?.map((item) => (
              <div key={item.label} className="group cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[9px] text-white/30 uppercase tracking-widest">{item.label} Concentration</span>
                  <span className="font-mono text-[11px] text-white/60 font-medium">{item.value}%</span>
                </div>
                <div className="h-1 w-full bg-white/[0.03] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${item.value}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between pt-5 border-t border-white/[0.04]">
            <span className="font-mono text-[9px] text-white/15 uppercase tracking-widest">Diversification Score</span>
            <span className="font-mono text-[11px] text-emerald-400 font-bold tracking-tighter">OPTIMAL (9.2/10)</span>
          </div>
        </section>

        {/* Section 2: Actionable Insights */}
        <section className="p-6 bg-white/[0.01]">
          <div className="flex items-center gap-2.5 mb-6">
            <Lightbulb className="h-3.5 w-3.5 text-amber-400/50" />
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">Risk Engine Insights</h2>
          </div>

          <div className="space-y-2.5">
            {insights?.map((insight, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-sm border border-white/[0.03] bg-[#070707] transition-all hover:bg-white/[0.02] cursor-pointer group">
                <div className="mt-0.5 shrink-0">
                  {insight.type === 'info' && <Zap className="h-3.5 w-3.5 text-blue-400/50" />}
                  {insight.type === 'warning' && <TrendingDown className="h-3.5 w-3.5 text-amber-400/50" />}
                  {insight.type === 'alert' && <AlertTriangle className="h-3.5 w-3.5 text-red-400/50" />}
                </div>
                <p className="text-[11px] leading-relaxed text-white/50 group-hover:text-white/80 transition-colors">{insight.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Priority Workflows */}
        <section className="p-6">
          <div className="flex items-center gap-2.5 mb-6">
            <ShieldCheck className="h-3.5 w-3.5 text-white/40" />
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">Quick Commands</h2>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {[
              { label: 'Rebalance Allocation', href: '/earn' },
              { icon: Zap, label: 'Access Credit Line', href: '/borrower' },
              { label: 'Export Risk Report', href: '#' },
            ].map((action) => (
              <button key={action.label} className="w-full flex items-center justify-between p-3.5 rounded-sm border border-white/[0.06] hover:bg-white/5 transition-colors group">
                <span className="font-mono text-[10px] text-white/60 uppercase tracking-widest group-hover:text-white/90">{action.label}</span>
                <ArrowRight className="h-3 w-3 text-white/10 group-hover:text-white/40 transition-colors group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Terminal Footer */}
      <div className="px-4 py-6 text-center">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/10 leading-relaxed">
          PRISM INTEL SYSTEM V4.1.2<br/>
          ENCRYPTED SESSION ACTIVE<br/>
          LAST ENGINE SYNC: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </aside>
  );
}
