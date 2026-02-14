'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
}

export interface Transaction {
  id: string;
  recipientName: string;
  amount: number;
  status: 'pending' | 'completed';
  createdAt: Date;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoggedIn: boolean;
  logout: () => void;
  transactionHistory: { transactions: Transaction[] };
  addTransaction: (tx: Transaction) => void;
  // Chat State
  chatMessages: any[]; 
  addChatMessage: (msg: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  
  // Mock Data for Dashboard (So it looks good immediately)
  const [transactionHistory, setTransactionHistory] = useState({
    transactions: [
      { id: '1', recipientName: 'Mama', amount: 50.00, status: 'completed', createdAt: new Date() },
      { id: '2', recipientName: 'Netflix', amount: 15.99, status: 'completed', createdAt: new Date() }
    ] as Transaction[]
  });

  const logout = () => {
    setUser(null);
    setChatMessages([]);
  };

  const addTransaction = (tx: Transaction) => {
    setTransactionHistory(prev => ({
      transactions: [tx, ...prev.transactions]
    }));
  };

  const addChatMessage = (msg: any) => {
    setChatMessages(prev => [...prev, msg]);
  };

  return (
    <AppContext.Provider value={{
      user, setUser, isLoggedIn: !!user, logout,
      transactionHistory, addTransaction,
      chatMessages, addChatMessage
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};