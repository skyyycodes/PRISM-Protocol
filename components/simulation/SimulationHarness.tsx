'use client';

import { ActionPanel } from './ActionPanel';
import { IdentityOrchestrator } from './IdentityOrchestrator';
import { SimulationConsole } from './SimulationConsole';
import { VaultStateDashboard } from './VaultStateDashboard';

export function SimulationHarness() {
  return (
    <div className="space-y-5">
      <IdentityOrchestrator />
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
        <VaultStateDashboard />
        <ActionPanel />
      </div>
      <SimulationConsole />
    </div>
  );
}
