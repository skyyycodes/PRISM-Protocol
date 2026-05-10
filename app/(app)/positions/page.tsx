import { PositionsOverview } from '@/components/positions/PositionsOverview';

export default function PositionsPage() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto [overscroll-behavior:contain] px-4 pt-7 pb-4">
      <PositionsOverview />
    </div>
  );
}
