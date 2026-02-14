'use client';

import React from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/types';
import { TransactionWidget } from './transaction-widget';

interface ChatMessageProps {
  message: ChatMessageType;
  onTransactionConfirm?: (transaction: any) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onTransactionConfirm }) => {
  const isUser = message.sender === 'user';

  // Render widget if it's a widget type message with transaction data
  if (message.type === 'widget' && message.transactionData && !isUser) {
    return (
      <div className="flex justify-start mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <TransactionWidget
          transaction={message.transactionData}
          onConfirm={() => onTransactionConfirm?.(message.transactionData)}
          isProcessing={false}
        />
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {/* AI Avatar (only for assistant) */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full glass bg-gradient-to-r from-teal-400/20 to-emerald-500/20 border border-teal-400/30 flex items-center justify-center mr-3 flex-shrink-0 mt-1">
          <div className="w-2 h-2 bg-teal-400 rounded-full" />
        </div>
      )}

     <div
  className={`max-w-[85%] px-5 py-4 rounded-[2rem] transition-all duration-300 ${
    isUser
      ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-tr-none shadow-[0_10px_20px_-5px_rgba(20,201,151,0.3)]'
      : 'bg-slate-800/80 backdrop-blur-md text-slate-200 border border-white/5 rounded-tl-none shadow-xl'
  }`}
>
  <p className="text-[15px] leading-relaxed font-medium">{message.content}</p>
</div>

      {/* User Avatar (only for user) */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center ml-3 flex-shrink-0 mt-1 text-xs font-bold text-white">
          U
        </div>
      )}
    </div>
  );
};