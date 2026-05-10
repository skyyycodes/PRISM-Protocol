'use client';

import { useParams } from 'next/navigation';
import { VaultDetail } from '@/components/dashboard/VaultDetail';

export default function VaultPage() {
  const params = useParams();
  const vaultId = parseInt(params.vaultId as string, 10);

  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto [overscroll-behavior:contain]">
      <div className="mx-auto max-w-[1600px] px-4 pt-7 pb-4">
        <VaultDetail vaultId={vaultId} />
      </div>
    </div>
  );
}
