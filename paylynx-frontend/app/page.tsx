'use client';

import { AppProvider } from '@/lib/app-context';
import { AppRouter } from '@/components/app-router';

export default function Page() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
