'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        
        // Optional but recommended — customize as needed
        loginMethods: ['email'], // or whatever you enabled
        appearance: {
          theme: 'dark',              // or 'light'
          accentColor: '#14b8a6',     // teal-ish to match your UI
          logo: '/logo.png',          // optional: add your logo in public/
        },
        // embeddedWallets: { createOnLogin: 'users-without-wallets' }, // if you want auto-embedded wallets
      }}
    >
      {children}
    </PrivyProvider>
  );
}