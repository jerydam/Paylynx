'use client';

import React from "react"

import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';

export const ChatHeader: React.FC = () => {
  const { user, setUser, transactionHistory } = useApp();

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div className="glass border-b border-teal-400/20 p-4 sticky top-0 z-40">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex-1">
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <div className="w-8 h-8 rounded-full glass bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-slate-900 glow-primary">
              P
            </div>
            Paylynx
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global payments powered by AI
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right glass bg-slate-900/50 border-teal-400/20 px-4 py-2 rounded-xl">
            <p className="text-xs text-slate-400">Balance</p>
            <p className="text-lg font-bold text-teal-400">$1,250.00 USDC</p>
          </div>
          <Button
            onClick={handleLogout}
            size="sm"
            className="glass border-teal-400/30 text-slate-200 hover:bg-teal-400/10 hover:border-teal-400/50 bg-transparent transition-all duration-200 rounded-full text-xs font-medium"
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};
