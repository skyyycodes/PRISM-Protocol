import { AppTopbar } from "@/components/app-shell/app-topbar";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Search } from "lucide-react";

export default function DashboardPage() {
  return (
    <>
      <AppTopbar />
      <div className="relative flex-1 overflow-y-auto px-6 py-5 [overscroll-behavior:contain]">
        <EmptyState
          icon={<Search className="h-6 w-6 text-white/45" />}
          title="No vault data yet"
          body="Vaults appear here once an admin runs setup-demo. Pick a different vault from the header dropdown or check your network."
        />
      </div>
    </>
  );
}
