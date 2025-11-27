'use client';

import { useState } from 'react';
import { Coins, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditModal: React.FC<CreditModalProps> = ({ isOpen, onClose }) => {
  const { addCredits } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const plans = [
    { credits: 500, price: "$5", name: "Creator Pack", popular: false },
    { credits: 1500, price: "$12", name: "Pro Studio", popular: true },
    { credits: 5000, price: "$35", name: "Agency", popular: false },
  ];

  const handlePurchase = async (amount: number) => {
    setIsLoading(true);
    // Simulate payment processing
    setTimeout(async () => {
      await addCredits(amount);
      setIsLoading(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-dark-border flex justify-between items-center bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Coins className="text-brand-400" /> Top Up Credits
            </h2>
            <p className="text-slate-400 text-sm mt-1">Generate more content without limits.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 grid md:grid-cols-3 gap-4">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`relative bg-slate-800/50 border ${plan.popular ? 'border-brand-500 ring-1 ring-brand-500' : 'border-dark-border'} rounded-xl p-6 flex flex-col items-center hover:bg-slate-800 transition-all group`}
            >
              {plan.popular && (
                <span className="absolute -top-3 bg-brand-600 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="text-slate-300 font-medium mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold text-white mb-1">{plan.credits}</div>
              <div className="text-brand-400 text-xs font-medium uppercase tracking-wider mb-6">Credits</div>
              <div className="text-2xl text-white font-semibold mb-6">{plan.price}</div>
              <button
                onClick={() => handlePurchase(plan.credits)}
                disabled={isLoading}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${plan.popular ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
              >
                {isLoading ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Buy Now"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
