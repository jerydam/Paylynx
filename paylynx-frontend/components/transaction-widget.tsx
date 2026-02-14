'use client';

import React from 'react';
import { useState } from 'react';
import { TransactionData } from '@/lib/types';
import { SwipeSlider } from './swipe-slider';

interface TransactionWidgetProps {
  transaction: TransactionData;
  onConfirm: () => void;
  isProcessing?: boolean;
}

export const TransactionWidget: React.FC<TransactionWidgetProps> = ({
  transaction,
  onConfirm,
  isProcessing = false,
}) => {
  return (
    <div className="w-full max-w-xs mx-auto glass bg-gradient-to-br from-slate-900/60 to-slate-800/60 border border-teal-400/30 rounded-2xl p-5 glow-primary mb-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 6H6.28l-.31-1.243A1 1 0 005 3H3z" />
          </svg>
        </div>
        <div>
          <p className="text-xs text-slate-400">Sending to</p>
          <p className="text-sm font-semibold text-slate-100">{transaction.recipientName}</p>
        </div>
      </div>

      {/* Amount */}
      <div className="bg-slate-800/50 rounded-xl p-4 mb-5 border border-slate-700/50">
        <p className="text-xs text-slate-400 mb-1">Amount</p>
        <p className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
          ${transaction.amount.toFixed(2)}
        </p>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Recipient</span>
          <span className="text-slate-200">{transaction.recipientName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Location</span>
          <span className="text-slate-200">{transaction.recipientCountry}</span>
        </div>
        <div className="border-t border-slate-700 pt-2 mt-2">
          <div className="flex justify-between mb-1">
            <span className="text-slate-400">Network Fee</span>
            <span className="text-slate-200 font-medium">$0.00</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-slate-300">Total</span>
            <span className="text-teal-400">${transaction.amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Swipe to Confirm */}
      <SwipeSlider onConfirm={onConfirm} isProcessing={isProcessing} />

      <p className="text-xs text-slate-500 text-center mt-3">Instant transfer • No hidden fees</p>
    </div>
  );
};
