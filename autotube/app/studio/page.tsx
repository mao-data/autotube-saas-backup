'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, FileText, VideoIcon, Wand2, Loader2, Copy, Coins } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { CreditModal } from '@/components/CreditModal';
import { ToastContainer } from '@/components/Toast';
import { useAuth } from '@/lib/contexts/AuthContext';
import { MOCK_VIDEOS } from '@/lib/mockData';
import type { YouTubeVideo, VideoBlueprint, ScriptSection } from '@/lib/types';

function StudioContent() {
  const { user, deductCredits } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get('videoId');

  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [studioMode, setStudioMode] = useState<'text' | 'video'>('text');
  const [studioOutput, setStudioOutput] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    if (videoId) {
      const video = MOCK_VIDEOS.find(v => v.id === videoId);
      if (video) {
        setSelectedVideo(video);
      }
    }
  }, [user, videoId, router]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "success");
  };

  const handleGenerate = async () => {
    if (!selectedVideo || !user) return;
    const cost = studioMode === 'text' ? 10 : 20;

    const hasCredits = await deductCredits(cost);
    if (!hasCredits) {
      showToast(`Not enough credits! Need ${cost} credits.`, "error");
      setShowCreditModal(true);
      return;
    }

    setIsLoading(true);
    setStudioOutput(null);

    setTimeout(() => {
      if (studioMode === 'text') {
        setStudioOutput(`# LinkedIn Post\n\n🚀 Just watched "${selectedVideo.title}" by ${selectedVideo.channelTitle}\n\nKey takeaways:\n• Innovation drives change\n• Consistency is key\n• Never stop learning\n\n#ContentCreation #AI #YouTube\n\n---\n\n# Twitter Thread\n\n1/5 🧵 ${selectedVideo.title}\n\nThis is a game-changer...\n\n2/5 The insights shared here...\n\n3/5 Implementation tips...\n\n---\n\n# Blog Summary\n\n## ${selectedVideo.title}\n\n${selectedVideo.description}\n\nRead more...`);
      } else {
        setStudioOutput({
          video_title: `${selectedVideo.title} - Short Version`,
          script_sections: [
            { timestamp: "0:00-0:05", voiceover: "Hook: Did you know this amazing fact?", visual_prompt: "Fast-paced montage with text overlay" },
            { timestamp: "0:05-0:15", voiceover: "Let me explain the main concept...", visual_prompt: "Animated infographic showing key points" },
            { timestamp: "0:15-0:30", voiceover: "Here's how you can apply this...", visual_prompt: "Real-world example footage" }
          ]
        });
      }
      setIsLoading(false);
      showToast("Content generated successfully!", "success");
    }, 2000);
  };

  if (!user || !selectedVideo) return null;

  return (
    <div className="min-h-screen">
      <Navbar onOpenCreditModal={() => setShowCreditModal(true)} />
      <CreditModal isOpen={showCreditModal} onClose={() => setShowCreditModal(false)} />
      <ToastContainer toast={toast} onClose={() => setToast(null)} />

      <div className="h-[calc(100vh-73px)] flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-1/4 bg-dark-surface border-r border-dark-border p-6 overflow-y-auto hidden md:block">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs font-semibold text-slate-500 hover:text-white mb-6 flex items-center gap-1"
          >
            <ChevronRight className="rotate-180" size={14} /> Back to Dashboard
          </button>
          <div className="rounded-xl overflow-hidden mb-4 border border-dark-border">
            <img src={selectedVideo.thumbnail} className="w-full" alt="thumb" />
          </div>
          <h3 className="font-bold text-white text-lg mb-2">{selectedVideo.title}</h3>
          <p className="text-sm text-slate-400 mb-6">{selectedVideo.channelTitle}</p>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-dark-border">
            <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-2">Description Context</h4>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-6">{selectedVideo.description}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-dark-bg">
          <div className="flex border-b border-dark-border bg-dark-surface/50">
            <button
              onClick={() => setStudioMode('text')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 ${
                studioMode === 'text'
                  ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <FileText size={18} /> Social Posts (10 <Coins size={10} className="inline" />)
            </button>
            <button
              onClick={() => setStudioMode('video')}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2 ${
                studioMode === 'video'
                  ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <VideoIcon size={18} /> Video Blueprint (20 <Coins size={10} className="inline" />)
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {!studioOutput ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-dark-border">
                  {studioMode === 'text' ? <FileText size={32} className="text-slate-500" /> : <VideoIcon size={32} className="text-slate-500" />}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Ready to generate {studioMode === 'text' ? 'text content' : 'a video blueprint'}?
                </h3>
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-brand-900/20 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />} Generate Content
                </button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {studioMode === 'text' ? (
                  <div className="bg-dark-surface border border-dark-border rounded-xl p-8 max-w-3xl mx-auto shadow-2xl">
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-dark-border">
                      <h2 className="text-xl font-bold text-white">Generated Drafts</h2>
                      <button onClick={() => copyToClipboard(studioOutput)} className="text-slate-400 hover:text-white transition-colors">
                        <Copy size={20} />
                      </button>
                    </div>
                    <div className="prose prose-invert max-w-none whitespace-pre-wrap text-slate-300">
                      {studioOutput}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold text-white">{(studioOutput as VideoBlueprint).video_title}</h2>
                    </div>
                    <div className="grid gap-4">
                      {(studioOutput as VideoBlueprint).script_sections?.map((section, idx) => (
                        <div key={idx} className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden flex flex-col md:flex-row shadow-lg">
                          <div className="p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-dark-border">
                            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono border border-dark-border">
                              {section.timestamp}
                            </span>
                            <p className="text-lg text-white font-medium mt-2">"{section.voiceover}"</p>
                          </div>
                          <div className="p-6 md:w-1/2 bg-slate-900/30">
                            <div className="flex justify-between mb-2">
                              <span className="text-xs font-bold text-purple-400 uppercase">Visual Prompt</span>
                              <button onClick={() => copyToClipboard(section.visual_prompt)} className="text-slate-500 hover:text-white">
                                <Copy size={14} />
                              </button>
                            </div>
                            <p className="text-sm text-slate-400 italic">{section.visual_prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-8 text-center pb-8">
                  <button onClick={() => setStudioOutput(null)} className="text-slate-400 hover:text-white underline text-sm">
                    Discard and Generate New
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Studio() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={40} />
      </div>
    }>
      <StudioContent />
    </Suspense>
  );
}
