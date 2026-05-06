import { AdminPanel } from '@/components/admin/AdminPanel';

export default function AdminPage() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto px-4 pb-12 pt-24 [overscroll-behavior:contain] sm:px-6 lg:px-8">
      <AdminPanel />
    </div>
  );
}
