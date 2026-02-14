'use client';

import React, { useState } from "react";
import { useApp } from '@/lib/app-context';
import { LandingPage } from './landing-page';
import { OnboardingPage } from './pages/onboarding-page';
import { DashboardPage } from './pages/dashboard-page';
import { ChatPage } from './pages/chat-page';

export const AppRouter: React.FC = () => {
  const { isLoggedIn, user } = useApp();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // 1. Not Logged In -> Landing Page
  if (!isLoggedIn) {
    return <LandingPage />;
  }

  // 2. Onboarding Check (if user not verified)
  if (!hasCompletedOnboarding && !user?.isVerified) {
    return <OnboardingPage onComplete={() => setHasCompletedOnboarding(true)} />;
  }

  // 3. Main App: Dashboard with Chat Overlay
  return (
    <div className="relative">
      {/* Dashboard is always visible when logged in */}
      <DashboardPage onOpenChat={() => setIsChatOpen(true)} />

      {/* Chat Overlay - Full Screen Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 animate-in slide-in-from-bottom duration-500">
          <div className="absolute inset-0 bg-slate-950">
            {/* Close Button */}
            <button 
              onClick={() => setIsChatOpen(false)}
              className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full glass bg-slate-900/50 text-slate-300 hover:bg-slate-800 hover:text-white transition-all border border-slate-700 hover:border-teal-500/30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
            
            <ChatPage /> 
          </div>
        </div>
      )}
    </div>
  );
};