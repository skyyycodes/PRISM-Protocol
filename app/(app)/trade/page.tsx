import { PrismTrade } from '@/components/simulation/PrismAppSurfaces';

export default function TradePage() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto [overscroll-behavior:contain]">
      <PrismTrade />
    </div>
  );
}
