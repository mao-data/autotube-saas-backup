import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="text-center">
        <Loader2 className="animate-spin text-brand-500 mx-auto mb-4" size={48} />
        <p className="text-slate-400 text-lg">Loading dashboard...</p>
      </div>
    </div>
  );
}
