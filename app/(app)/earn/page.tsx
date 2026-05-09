import { MarketOverview } from '@/components/dashboard/MarketOverview';

export default function EarnPage() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto [overscroll-behavior:contain]">
      <div className="mx-auto max-w-[1440px] px-8 pt-12">
        <MarketOverview />
      </div>
    </div>
  );
}
