'use client';

import React, { useState } from 'react';
import { TransactionData } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface TransactionSuccessProps {
  transaction: TransactionData;
  txHash?: string;
  onClose: () => void;
  onSaveContact?: (name: string, address: string) => Promise<void>;
}

export const TransactionSuccess: React.FC<TransactionSuccessProps> = ({
  transaction,
  txHash,
  onClose,
  onSaveContact,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [saveContact, setSaveContact] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);

  const handleCopyTxn = () => {
    const textToCopy = txHash || transaction.id;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareReceipt = () => {
    const receiptText = `✅ Payment Sent

Amount: $${transaction.amount.toFixed(2)} USDC
To: ${transaction.recipientName}
${txHash ? `TX: ${txHash.slice(0, 10)}...${txHash.slice(-8)}` : `Ref: ${transaction.id.slice(0, 12)}`}

Powered by Paylynx`;

    if (navigator.share) {
      navigator.share({
        title: 'Payment Receipt',
        text: receiptText,
      });
    } else {
      navigator.clipboard.writeText(receiptText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSaveContact = async () => {
    if (!onSaveContact || !saveContact) return;
    
    setIsSavingContact(true);
    try {
      await onSaveContact(transaction.recipientName, transaction.recipient);
      alert(`✅ Saved ${transaction.recipientName} to your contacts!`);
    } catch (err: any) {
      alert(`❌ Failed to save contact: ${err.message}`);
    } finally {
      setIsSavingContact(false);
    }
  };

  const explorerUrl = txHash 
    ? `https://sepolia.basescan.org/tx/${txHash}`
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
      <div 
        className="glass border border-green-400/30 rounded-2xl backdrop-blur-xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in duration-300" 
        style={{ boxShadow: '0 0 30px rgba(34, 197, 94, 0.3)' }}
      >
        {/* Success Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-green-500 rounded-full opacity-20 blur-2xl animate-pulse" />
          <div className="relative inline-flex items-center justify-center w-20 h-20 glass rounded-full bg-green-500/20 border border-green-400/30">
            <svg className="w-10 h-10 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        <h2 className="text-3xl font-bold gradient-text mb-2">Transfer Sent!</h2>
        <p className="text-slate-400 mb-8">
          Your money is on its way to <span className="text-slate-100 font-medium">{transaction.recipientName}</span>
        </p>

        {/* Transaction Details */}
        <div className="space-y-3 mb-6 glass bg-slate-900/50 border-teal-400/20 p-5 rounded-xl text-left">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Amount:</span>
            <span className="font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              ${transaction.amount.toFixed(2)} USDC
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">To:</span>
            <span className="font-semibold text-slate-100">{transaction.recipientName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Address:</span>
            <span className="font-mono text-xs text-teal-400">
              {transaction.recipient.slice(0, 6)}...{transaction.recipient.slice(-4)}
            </span>
          </div>
          {txHash && (
            <div className="flex justify-between items-center pt-2 border-t border-slate-700">
              <span className="text-slate-400 text-sm">TX Hash:</span>
              <span className="font-mono text-xs text-teal-400">
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Status:</span>
            <span className="text-green-400 font-medium flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Confirmed
            </span>
          </div>
        </div>

        {/* Save Contact Toggle */}
        {onSaveContact && (
          <div className="flex items-center gap-3 mb-6 p-3 glass bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-teal-500/30 transition-colors">
            <input
              type="checkbox"
              id="save-contact"
              checked={saveContact}
              onChange={(e) => setSaveContact(e.target.checked)}
              className="w-4 h-4 rounded border-teal-400 cursor-pointer accent-teal-500"
            />
            <label htmlFor="save-contact" className="text-sm text-slate-300 cursor-pointer flex-1 text-left">
              💾 Save {transaction.recipientName} as contact for future payments
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {explorerUrl && (
            <Button
              onClick={() => window.open(explorerUrl, '_blank')}
              className="w-full glass text-slate-200 border-purple-500/30 hover:border-purple-400/50 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on Block Explorer
            </Button>
          )}
          
          <Button
            onClick={handleShareReceipt}
            className="w-full glass text-slate-200 border-slate-600/30 hover:border-teal-400/30 bg-transparent rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C9.539 14.197 10 15.369 10 16.5c0 1.933-1.567 3.5-3.5 3.5S3 18.433 3 16.5 4.567 13 6.5 13c.823 0 1.612.195 2.304.563m6.828-6.117a6 6 0 00-9.11 8.47M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Share Receipt
          </Button>
          
          <Button
            onClick={handleCopyTxn}
            className="w-full glass text-slate-200 border-teal-400/30 hover:border-teal-400/50 bg-transparent rounded-xl font-medium transition-all duration-200"
          >
            {isCopied ? '✅ Copied!' : `📋 Copy ${txHash ? 'TX Hash' : 'Reference'}`}
          </Button>
          
          {saveContact && onSaveContact && (
            <Button
              onClick={handleSaveContact}
              disabled={isSavingContact}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold transition-all duration-200"
            >
              {isSavingContact ? '💾 Saving...' : '💾 Save Contact Now'}
            </Button>
          )}
          
          <Button
            onClick={() => {
              if (saveContact && onSaveContact) {
                handleSaveContact().then(() => onClose());
              } else {
                onClose();
              }
            }}
            disabled={isSavingContact}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold transition-all duration-200"
          >
            {saveContact && onSaveContact ? 'Save & Return to Chat' : 'Return to Chat'}
          </Button>
        </div>

        {/* Footer Info */}
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-500">
            🔒 Transaction secured on Base Sepolia blockchain
          </p>
          {txHash && (
            <p className="text-xs text-slate-600 mt-1 font-mono">
              Block explorer verification available
            </p>
          )}
        </div>
      </div>
    </div>
  );
};