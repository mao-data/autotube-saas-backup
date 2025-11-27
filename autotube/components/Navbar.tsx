'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Wand2, Coins, LogOut, AlertCircle, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface NavbarProps {
  onOpenCreditModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreditModal }) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!user) return null;

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-dark-surface/90 backdrop-blur-md border-b border-dark-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/dashboard')}>
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white">
          <Wand2 size={18} />
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-brand-200">
          AutoTube
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {user.isDemo && (
          <div className="hidden md:flex items-center gap-1 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/20">
            <AlertCircle size={12} /> Demo Mode
          </div>
        )}

        <button
          onClick={() => router.push('/schedule')}
          className={`text-sm font-medium hover:text-brand-400 transition-colors ${isActive('/schedule') ? 'text-brand-400' : 'text-slate-400'}`}
        >
          Calendar
        </button>

        <button
          onClick={() => router.push('/my-assets')}
          className={`text-sm font-medium hover:text-brand-400 transition-colors ${isActive('/assets') ? 'text-brand-400' : 'text-slate-400'}`}
        >
          My Assets
        </button>

        <div className="h-6 w-px bg-dark-border mx-2"></div>

        <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-dark-border">
          <Coins size={14} className="text-yellow-400" />
          <span className="text-sm font-semibold text-slate-200">{user.credits}</span>
        </div>

        <button
          onClick={onOpenCreditModal}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-all shadow-lg shadow-brand-900/20"
        >
          Buy Credits
        </button>

        <div className="relative group ml-2">
          <div className="w-9 h-9 rounded-full border-2 border-dark-border bg-slate-700 flex items-center justify-center overflow-hidden cursor-pointer">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={16} className="text-slate-400" />
            )}
          </div>
          <div className="absolute right-0 top-full mt-2 w-48 bg-dark-surface border border-dark-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity invisible group-hover:visible p-2">
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-md"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
