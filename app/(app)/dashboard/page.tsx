import { AppTopbar } from "@/components/app-shell/app-topbar";
import { SimulationHarness } from "@/components/simulation/SimulationHarness";

export default function DashboardPage() {
  return (
    <>
      <AppTopbar />
      <div className="relative flex-1 overflow-y-auto px-6 py-5 [overscroll-behavior:contain]">
        <SimulationHarness />
      </div>
    </>
  );
}
