'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Layout } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CreditModal } from '@/components/CreditModal';
import { ToastContainer } from '@/components/Toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import type { GeneratedContent } from '@/lib/types';

export default function Assets() {
  const { user } = useAuth();
  const router = useRouter();
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedContent[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar onOpenCreditModal={() => setShowCreditModal(true)} />
      <CreditModal isOpen={showCreditModal} onClose={() => setShowCreditModal(false)} />
      <ToastContainer toast={toast} onClose={() => setToast(null)} />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white">
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <h2 className="text-3xl font-bold text-white">My Creative Assets</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {generatedAssets.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layout size={24} />
              </div>
              No assets generated yet. Go to{' '}
              <button onClick={() => router.push('/dashboard')} className="text-brand-400 underline">
                Dashboard
              </button>{' '}
              to create some!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
