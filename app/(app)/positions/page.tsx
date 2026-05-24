import { Metadata } from 'next';
import { PositionsOverview } from '@/components/positions/PositionsOverview';

export const metadata: Metadata = {
  title: 'Portfolio Exposure',
};

export default function PositionsPage() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto [overscroll-behavior:contain] px-8 py-8 md:px-10 md:py-10">
      <PositionsOverview />
    </div>
  );
}
