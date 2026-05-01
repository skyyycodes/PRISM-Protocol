import { AppTopbar } from "@/components/app-shell/app-topbar";
import { SimulationHarness } from "@/components/simulation/SimulationHarness";

export default function DashboardPage() {
  return (
    <>
      <AppTopbar />
      <div className="relative flex-1 overflow-y-auto px-4 py-4 [overscroll-behavior:contain] sm:px-6 sm:py-5">
        <SimulationHarness />
      </div>
    </>
  );
}
