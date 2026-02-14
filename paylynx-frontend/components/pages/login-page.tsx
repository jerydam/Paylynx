// app/login/page.tsx  (or /signin)
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useApp();
  const { ready, authenticated, user: privyUser, login } = usePrivy();

  useEffect(() => {
    if (!ready) return;
    if (authenticated && privyUser) {
      setUser({
        id: privyUser.id,
        name: privyUser.email?.address?.split('@')[0] ||
             (privyUser.wallet?.address ? privyUser.wallet.address.slice(0,6)+'...'+privyUser.wallet.address.slice(-4) : 'User'),
        email: privyUser.email?.address || '',
        isVerified: true,
      });
      router.replace('/chat'); // or /onboarding if you force it
    }
  }, [ready, authenticated, privyUser, setUser, router]);

  // Redirect already-authenticated users away from login page
  useEffect(() => {
    if (ready && authenticated) {
      router.replace('/chat');
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-950 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass border border-teal-400/30 rounded-2xl backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold gradient-text">Welcome to Paylynx</CardTitle>
          <CardDescription className="text-slate-400 mt-2">
            Sign in securely — no passwords, no hassle
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <Button
            onClick={login}
            className="w-full h-12 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-semibold rounded-xl shadow-lg transition-all hover:scale-[1.02]"
          >
            Continue with Privy
          </Button>

          <div className="text-center text-sm text-slate-500 pt-4">
            <p>Powered by Privy • Secured on Celo</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}