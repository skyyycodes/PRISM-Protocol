import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { ContentHeader } from "@/components/app-shell/content-header";
import { AppProviders } from "@/components/providers/app-providers";

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <div className="relative flex h-screen w-full bg-black text-white overflow-hidden">
        {/* Left Sidebar */}
        <AppSidebar />

        {/* Main Content Area */}
        <div className="relative flex flex-1 flex-col pl-[72px] min-w-0 h-screen">
          {/* Background Decorator */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                "radial-gradient(circle at 14% 10%, rgba(236,72,153,0.08) 0%, transparent 32%), radial-gradient(circle at 88% 12%, rgba(168,85,247,0.08) 0%, transparent 32%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* Content Header (Search, Wallet, etc) */}
          <ContentHeader />

          {/* Page Content Scroller */}
          <main 
            className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-8"
            data-app-scroll
          >
            {children}
          </main>
        </div>
      </div>
    </AppProviders>
  );
}
