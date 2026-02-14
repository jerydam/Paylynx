'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/app-context';
import { usePrivy } from '@privy-io/react-auth'; // <--- REAL AUTH
import { useRouter } from 'next/navigation';

export const LandingPage: React.FC = () => {
  const { setUser } = useApp();
  const { login, ready, authenticated, user: privyUser } = usePrivy();
  
  // Auto-sync Privy User to Global State
  useEffect(() => {
    if (ready && authenticated && privyUser) {
      setUser({
        id: privyUser.id,
        name: privyUser.email?.address || privyUser.wallet?.address || 'User',
        email: privyUser.email?.address || '',
        isVerified: true
      });
    }
  }, [ready, authenticated, privyUser, setUser]);

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden flex flex-col items-center justify-center text-center px-4">
      
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] mix-blend-screen" />

      <div className="relative z-10 max-w-3xl space-y-8 animate-in fade-in zoom-in duration-700">
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass bg-slate-900/40 border border-teal-500/30 shadow-lg shadow-teal-500/10 backdrop-blur-md mb-6">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span className="text-xs font-medium text-teal-300 tracking-wide uppercase">AI-Powered Remittance</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
          Money moves at the <br />
          <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            speed of thought.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed">
          Send global payments with a simple text. No forms, no confusion. 
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <Button 
            onClick={login} // <--- TRIGGERS PRIVY MODAL
            className="h-14 px-8 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-lg font-semibold shadow-xl shadow-teal-500/20 transition-all hover:scale-105 active:scale-95"
          >
            Get Started
          </Button>
        </div>
        
        {/* Trust Signals */}
        <div className="pt-12 flex items-center justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          <span className="font-bold text-slate-300">PRIVY SECURED</span>
          <span className="font-bold text-slate-300">ON CELO</span>
        </div>
      </div>
    </div>
  );
};