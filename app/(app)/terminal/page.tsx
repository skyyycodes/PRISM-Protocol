import { ProtocolAnalytics } from '@/components/simulation/ProtocolAnalytics';

export default function TerminalPage() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto [overscroll-behavior:contain]">
      <ProtocolAnalytics />
    </div>
  );
}
