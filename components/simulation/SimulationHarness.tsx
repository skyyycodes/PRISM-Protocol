'use client';

import { ActionPanel } from './ActionPanel';
import { PrismOverview } from './PrismAppSurfaces';

export function SimulationHarness() {
  return (
    <>
      <div className="border-b border-white/10 bg-black/40 pt-24">
        <div className="mx-auto max-w-[1200px] px-6 pb-8">
          <ActionPanel />
        </div>
      </div>
      <PrismOverview />
    </>
  );
}
