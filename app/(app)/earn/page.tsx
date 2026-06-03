import { Metadata } from 'next';
import { MarketOverview } from '@/components/dashboard/MarketOverview';

export const metadata: Metadata = {
  title: 'Marketplace',
};

export default function EarnPage() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto [overscroll-behavior:contain] px-8 py-8 md:px-10 md:py-10">
      <MarketOverview />
    </div>
  );
}
