'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Youtube, Loader2, CheckSquare, Wand2, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CreditModal } from '@/components/CreditModal';
import { ToastContainer } from '@/components/Toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import { MOCK_VIDEOS } from '@/lib/mockData';
import type { YouTubeVideo } from '@/lib/types';

export default function Dashboard() {
  const { user, deductCredits } = useAuth();
  const router = useRouter();
  const [videos, setVideos] = useState<YouTubeVideo[]>(MOCK_VIDEOS);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Batch selection
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
  };

  const toggleVideoSelection = (id: string) => {
    const newSet = new Set(selectedVideoIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedVideoIds(newSet);
  };

  const connectYouTube = () => {
    if (!user) {
      showToast("Please login first", "error");
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_YOUTUBE_REDIRECT_URI ||
      `${window.location.origin}/api/youtube/auth`;

    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `access_type=offline&` +
      `state=${user.uid}&` +
      `prompt=consent`;

    window.location.href = authUrl;
  };

  const handleBatchGenerate = async () => {
    if (selectedVideoIds.size === 0 || !user) return;

    const COST_PER_ITEM = 10;
    const totalCost = selectedVideoIds.size * COST_PER_ITEM;

    const hasCredits = await deductCredits(totalCost);
    if (!hasCredits) {
      showToast(`Not enough credits! Need ${totalCost} credits.`, "error");
      setShowCreditModal(true);
      return;
    }

    setBatchProgress({ current: 0, total: selectedVideoIds.size });

    const selectedVideosList = videos.filter(v => selectedVideoIds.has(v.id));

    for (let i = 0; i < selectedVideosList.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBatchProgress({ current: i + 1, total: selectedVideoIds.size });
    }

    setBatchProgress(null);
    setSelectedVideoIds(new Set());
    setIsBatchMode(false);
    showToast(`Batch Complete: ${selectedVideosList.length} items generated.`, "success");
    router.push('/assets');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Navbar onOpenCreditModal={() => setShowCreditModal(true)} />
      <CreditModal isOpen={showCreditModal} onClose={() => setShowCreditModal(false)} />
      <ToastContainer toast={toast} onClose={() => setToast(null)} />

      <div className="max-w-7xl mx-auto px-6 py-10 pb-24">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-3">Content Discovery</h2>
            <p className="text-slate-400">
              {youtubeConnected ? 'Your YouTube videos' : 'Sample videos (Connect YouTube for real data)'}
            </p>
          </div>
          <div className="flex gap-2">
            {!user?.isDemo && !youtubeConnected && (
              <button
                onClick={connectYouTube}
                disabled={isLoadingVideos}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white border border-red-500 transition-colors disabled:opacity-50"
              >
                <Youtube size={16} />
                Connect YouTube
              </button>
            )}
            {isLoadingVideos && (
              <div className="flex items-center gap-2 px-4 py-2 text-slate-400 text-sm">
                <Loader2 size={16} className="animate-spin" />
                Loading videos...
              </div>
            )}
            <button
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedVideoIds(new Set());
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isBatchMode
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CheckSquare size={16} />
              {isBatchMode ? 'Exit Selection' : 'Batch Select'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => {
            const isSelected = selectedVideoIds.has(video.id);
            return (
              <div
                key={video.id}
                className={`group relative bg-dark-surface border rounded-xl overflow-hidden transition-all cursor-pointer hover:-translate-y-1 ${
                  isSelected ? 'border-brand-500 ring-1 ring-brand-500' : 'border-dark-border hover:border-brand-500/50'
                }`}
                onClick={() => {
                  if (isBatchMode) {
                    toggleVideoSelection(video.id);
                  } else {
                    router.push(`/studio?videoId=${video.id}`);
                  }
                }}
              >
                <div className="relative aspect-video">
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  {isBatchMode && (
                    <div
                      className={`absolute top-2 right-2 w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                        isSelected ? 'bg-brand-500 border-brand-500 text-white' : 'bg-black/40 border-white/50'
                      }`}
                    >
                      {isSelected && <CheckSquare size={14} />}
                    </div>
                  )}
                  {!isBatchMode && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                        <Wand2 size={16} /> Remix
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white line-clamp-2 mb-2 group-hover:text-brand-300 transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Youtube size={12} /> {video.channelTitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* BATCH ACTION BAR */}
        {selectedVideoIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-dark-border rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in z-40">
            <div className="flex items-center gap-2">
              <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {selectedVideoIds.size}
              </span>
              <span className="text-sm text-slate-300 font-medium">Selected</span>
            </div>
            <div className="h-4 w-px bg-slate-700"></div>
            <div className="text-sm text-slate-400">
              Est. Cost: <span className="text-yellow-400 font-bold">{selectedVideoIds.size * 10}</span> credits
            </div>
            <button
              onClick={handleBatchGenerate}
              className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <Sparkles size={16} />
              Batch Generate
            </button>
          </div>
        )}

        {/* BATCH PROGRESS MODAL */}
        {batchProgress && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-dark-surface border border-dark-border p-8 rounded-2xl w-full max-w-md text-center">
              <Loader2 size={48} className="animate-spin text-brand-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Batch Processing...</h3>
              <p className="text-slate-400 mb-6">Using AI to analyze and generate content.</p>
              <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden mb-2">
                <div
                  className="bg-brand-500 h-full transition-all duration-500 ease-out"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Processing {batchProgress.current} of {batchProgress.total}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
