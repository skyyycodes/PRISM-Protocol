"use client";

import { useEffect, useRef, useState } from "react";

import {
  bagsApiConfigured,
  getTokenClaimStats,
  getTokenLifetimeFees,
  lamportsToSol,
} from "@/app/lib/bags";
import { BAGS_PROTOCOL_TOKEN_MINT } from "@/app/lib/constants";

interface FeesState {
  loading: boolean;
  lifetimeSol: number;
  trailing30dSol: number;
  recipients: number;
  apiLive: boolean;
}

const PLACEHOLDER_MINT =
  "8wXtPeU6557ETkp9WHFY1n1EcU6NxDvbAggHGsMYiHsB"; // any deterministic seed; mock uses it
const STORYBOARD_BAGS_URL = "https://bags.fm";

/**
 * Marketing-page strip showing $PRISM Bags fee revenue.
 *
 * If `NEXT_PUBLIC_BAGS_PROTOCOL_TOKEN_MINT` is set, we render real Bags
 * data. Otherwise we render the deterministic mock so the strip is never
 * empty during the scaffolding phase.
 */
export function BagsFeesWidget() {
  const [state, setState] = useState<FeesState>({
    loading: true,
    lifetimeSol: 0,
    trailing30dSol: 0,
    recipients: 0,
    apiLive: false,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const mint = BAGS_PROTOCOL_TOKEN_MINT || PLACEHOLDER_MINT;
    Promise.all([getTokenLifetimeFees(mint), getTokenClaimStats(mint)])
      .then(([lifetime, stats]) => {
        if (!mounted.current) return;
        setState({
          loading: false,
          lifetimeSol: lifetime.lifetimeSol,
          trailing30dSol: lamportsToSol(stats.trailing30dLamports),
          recipients: stats.uniqueDividendRecipients,
          apiLive: bagsApiConfigured() && Boolean(BAGS_PROTOCOL_TOKEN_MINT),
        });
      })
      .catch(() => {
        if (!mounted.current) return;
        setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <a
      href={
        BAGS_PROTOCOL_TOKEN_MINT
          ? `${STORYBOARD_BAGS_URL}/${BAGS_PROTOCOL_TOKEN_MINT}`
          : STORYBOARD_BAGS_URL
      }
      target="_blank"
      rel="noreferrer"
      className="group block w-full"
    >
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-foreground/10 bg-[#eca8d6]/[0.04] p-5 backdrop-blur-md transition-colors hover:border-[#eca8d6]/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-2 w-2 items-center justify-center">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                state.apiLive
                  ? "bg-[#eca8d6] animate-pulse"
                  : "bg-amber-400/80"
              }`}
            />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#eca8d6]">
              $PRISM on Bags
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {state.apiLive
                ? "Live · trading fees feed senior tranche reserve"
                : "Scaffold · mock data until launch + API key"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 font-mono text-xs sm:gap-10">
          <Stat label="Lifetime SOL" value={fmt(state.lifetimeSol, state.loading)} />
          <Stat label="Trailing 30d" value={fmt(state.trailing30dSol, state.loading)} />
          <Stat
            label="Holders rewarded"
            value={state.loading ? "—" : state.recipients.toString()}
          />
        </div>
      </div>
    </a>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function fmt(sol: number, loading: boolean): string {
  if (loading) return "—";
  if (sol === 0) return "0 SOL";
  if (sol < 0.001) return `${sol.toFixed(4)} SOL`;
  if (sol < 10) return `${sol.toFixed(2)} SOL`;
  return `${sol.toFixed(0)} SOL`;
}
