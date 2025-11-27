'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Youtube, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function Home() {
  const { user, isLoading: authLoading, login, loginDemo } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error: any) {
      console.error('Login error:', error);
      alert(error.message || 'Login failed');
    }
  };

  const handleDemoLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      loginDemo();
      setIsLoading(false);
    }, 800);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/40 via-dark-bg to-dark-bg"></div>
      <div className="relative z-10 text-center max-w-lg px-6">
        <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-brand-500/20 mb-8 rotate-3">
          <Wand2 size={40} className="text-white" />
        </div>
        <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">
          AutoTube <span className="text-brand-400">Hub</span>
        </h1>
        <p className="text-lg text-slate-400 mb-8 leading-relaxed">
          The AI-powered workspace for creators. Batch generate content, schedule posts, and scale your channel.
        </p>
        <div className="space-y-4">
          <button
            onClick={handleLogin}
            className="w-full group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-white transition-all duration-200 bg-white/10 border border-white/10 rounded-full hover:bg-white/20"
          >
            <Youtube className="mr-2 text-red-500 fill-current" />
            <span>Continue with Google</span>
          </button>
          <button
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-slate-400 transition-all duration-200 border border-slate-700 rounded-full hover:bg-slate-800 hover:text-white"
          >
            {isLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            Enter as Guest (Demo Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
