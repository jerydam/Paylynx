'use client';

import React from "react"

import { useState } from 'react';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface OnboardingPageProps {
  onComplete: () => void;
}

const COUNTRIES = ['US', 'UK', 'CA', 'AU', 'SG', 'PH', 'IN', 'MX', 'BR'];

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete }) => {
  const { user, setUser } = useApp();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (step === 1) {
      if (!phone) {
        setIsLoading(false);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!country) {
        setIsLoading(false);
        return;
      }
      // Update user and complete onboarding
      if (user) {
        setUser({
          ...user,
          phone,
          country,
          isVerified: true,
        });
      }
      onComplete();
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-950 to-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 -z-10 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl animate-float" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md">
        <div className="glass border border-teal-400/30 rounded-2xl backdrop-blur-xl shadow-2xl glow-primary p-8">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    s <= step ? 'bg-gradient-to-r from-teal-400 to-emerald-500 shadow-lg shadow-teal-400/50' : 'bg-slate-700/50'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs font-medium text-slate-400">
              Step {step} of 2
            </p>
          </div>

            {/* Step 1: Phone */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-3xl font-bold gradient-text mb-2">
                  Verify Your Phone
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                  We{"'"}ll use this to confirm your identity
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full glass bg-slate-900/50 border-teal-400/30 text-slate-100 placeholder:text-slate-600 focus-visible:ring-teal-400 rounded-xl px-4 py-2.5"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Country */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                <h2 className="text-3xl font-bold gradient-text mb-2">
                  Select Your Country
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                  Where are you currently located?
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCountry(c)}
                      disabled={isLoading}
                      className={`p-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                        country === c
                          ? 'glass bg-gradient-to-r from-teal-500/30 to-emerald-500/30 text-teal-300 border-teal-400/50 glow-primary'
                          : 'glass text-slate-300 border-slate-600/30 hover:border-teal-400/30 hover:text-slate-100'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleNext}
              disabled={isLoading || (step === 1 && !phone) || (step === 2 && !country)}
              className="w-full mt-8 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white h-11 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 glow-primary"
            >
              {isLoading ? 'Continuing...' : step === 2 ? 'Get Started' : 'Next'}
            </Button>
        </div>
      </div>
    </div>
  );
};
