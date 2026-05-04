import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppProviders } from "@/components/providers/app-providers";

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <div className="relative flex min-h-[100svh] flex-col overflow-hidden bg-black text-white lg:h-screen lg:min-h-[640px]">
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
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />

        <AppHeader />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <section
              aria-label="Main"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              {children}
            </section>
          </div>
        </div>
      </div>
    </AppProviders>
  );
}
