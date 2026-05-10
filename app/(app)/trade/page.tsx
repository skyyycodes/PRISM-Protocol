import { TradeTerminal } from '@/components/simulation/TradeTerminal';

export default function TradePage() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto [overscroll-behavior:contain] px-6 py-6">
      <TradeTerminal />
    </div>
  );
}
