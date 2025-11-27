'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, Clock } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CreditModal } from '@/components/CreditModal';
import { ToastContainer } from '@/components/Toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import { MOCK_VIDEOS } from '@/lib/mockData';
import type { GeneratedContent } from '@/lib/types';

const PlusIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export default function Schedule() {
  const { user, deductCredits } = useAuth();
  const router = useRouter();
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scheduledAssets, setScheduledAssets] = useState<GeneratedContent[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
  };

  const handleAutoSchedule = async () => {
    if (!user) return;
    const ITEMS_TO_GENERATE = 5;
    const COST = ITEMS_TO_GENERATE * 10;

    const hasCredits = await deductCredits(COST);
    if (!hasCredits) {
      showToast(`Not enough credits! Need ${COST} credits.`, "error");
      setShowCreditModal(true);
      return;
    }

    setIsLoading(true);
    showToast("Auto-Pilot Started: Analyzing trends & scheduling...", "success");

    setTimeout(() => {
      setIsLoading(false);
      showToast(`Auto-Pilot: Scheduled ${ITEMS_TO_GENERATE} posts for the upcoming week!`, "success");
    }, 3000);
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const getAssetsForDate = (date: Date) => {
    return scheduledAssets.filter(asset => {
      if (!asset.scheduledDate) return false;
      const aDate = new Date(asset.scheduledDate.seconds * 1000);
      return aDate.getDate() === date.getDate() && aDate.getMonth() === date.getMonth();
    });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar onOpenCreditModal={() => setShowCreditModal(true)} />
      <CreditModal isOpen={showCreditModal} onClose={() => setShowCreditModal(false)} />
      <ToastContainer toast={toast} onClose={() => setToast(null)} />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Content Calendar</h2>
            <p className="text-slate-400">Automate your posting schedule with AI Agents.</p>
          </div>
          <button
            onClick={handleAutoSchedule}
            disabled={isLoading}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            Auto-Pilot: Fill My Week
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {days.map((day, idx) => {
            const dayAssets = getAssetsForDate(day);
            const isToday = idx === 0;

            return (
              <div
                key={idx}
                className={`min-h-[300px] rounded-xl border p-3 flex flex-col ${
                  isToday ? 'bg-brand-900/10 border-brand-500/50' : 'bg-dark-surface border-dark-border'
                }`}
              >
                <div className="text-center mb-4 pb-2 border-b border-white/5">
                  <div className={`text-xs uppercase font-bold mb-1 ${isToday ? 'text-brand-400' : 'text-slate-500'}`}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-xl font-bold ${isToday ? 'text-white' : 'text-slate-300'}`}>{day.getDate()}</div>
                </div>

                <div className="flex-1 space-y-2">
                  {dayAssets.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-700">
                        <PlusIcon size={14} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
