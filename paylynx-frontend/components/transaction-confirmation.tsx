'use client';

import React from "react"

import { useState } from 'react';
import { TransactionData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/lib/app-context';
import { TransactionSuccess } from './transaction-success';

interface TransactionConfirmationProps {
  transaction: TransactionData;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransactionConfirmation: React.FC<TransactionConfirmationProps> = ({
  transaction,
  onConfirm,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const { addTransaction } = useApp();

  const handleConfirm = async () => {
    setIsProcessing(true);
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mark as completed
    addTransaction({
      ...transaction,
      status: 'completed',
    });
    setIsCompleted(true);
  };

  if (isCompleted) {
    return <TransactionSuccess transaction={transaction} onClose={onCancel} />;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass border border-teal-400/30 rounded-2xl backdrop-blur-xl shadow-2xl glow-primary w-full max-w-md p-8 animate-in fade-in zoom-in duration-300">
        <h2 className="text-3xl font-bold gradient-text mb-8">Confirm Transfer</h2>

        <div className="space-y-3 mb-8 glass bg-slate-900/50 border-teal-400/20 p-5 rounded-xl">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">To:</span>
            <span className="font-semibold text-slate-100">{transaction.recipientName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Country:</span>
            <span className="font-semibold text-slate-100">{transaction.recipientCountry}</span>
          </div>
          <div className="border-t border-slate-700 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Amount:</span>
              <span className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                ${transaction.amount.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm pt-2">
            <span className="text-slate-400">Fee:</span>
            <span className="text-slate-300">$0.00</span>
          </div>
        </div>

        <div className="glass bg-green-500/10 border border-green-400/30 text-green-300 p-3.5 rounded-xl text-sm mb-8 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>Transfer will arrive within 1-2 business days</span>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 glass text-slate-200 border-slate-600/30 hover:border-teal-400/30 bg-transparent rounded-xl font-medium transition-all duration-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 glow-primary"
          >
            {isProcessing ? 'Processing...' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
};
