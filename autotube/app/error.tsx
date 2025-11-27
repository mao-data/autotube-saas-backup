'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg px-6">
      <div className="max-w-md w-full bg-dark-surface border border-dark-border rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Something went wrong!</h2>
        <p className="text-slate-400 mb-6">
          We encountered an unexpected error. Please try again.
        </p>
        {error.message && (
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-slate-500 font-mono break-words">{error.message}</p>
          </div>
        )}
        <button
          onClick={reset}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
