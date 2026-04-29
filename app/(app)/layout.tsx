import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { DevBadge } from "@/components/app-shell/dev-badge";
import { AppProviders } from "@/components/providers/app-providers";

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
    <div className="relative h-screen min-h-[640px] overflow-hidden bg-black text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 14% 10%, rgba(236,72,153,0.14) 0%, transparent 32%), radial-gradient(circle at 88% 12%, rgba(168,85,247,0.14) 0%, transparent 32%), radial-gradient(circle at 54% 100%, rgba(217,70,239,0.10) 0%, transparent 42%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <AppHeader />

      <div className="relative z-10 flex h-full min-h-0 flex-col pt-20">
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          <AppSidebar />
          <section
            aria-label="Main"
            className="flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden"
          >
            {children}
          </section>
        </div>
      </div>

      <DevBadge />
    </div>
    </AppProviders>
  );
}
