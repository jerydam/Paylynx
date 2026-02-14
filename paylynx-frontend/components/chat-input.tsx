'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  const handleVoiceToggle = () => {
    // Placeholder for voice functionality
    setIsRecording(!isRecording);
    // TODO: Implement actual voice recording with waveform animation
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          
          {/* Voice Button */}
          <button
            type="button"
            onClick={handleVoiceToggle}
            disabled={disabled}
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording 
                ? 'bg-red-500 shadow-lg shadow-red-500/50 scale-110' 
                : 'glass bg-slate-900/50 border border-slate-700 hover:border-teal-500/50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRecording ? (
              // Recording indicator with waveform style
              <div className="flex gap-0.5 items-center h-4">
                <div className="w-0.5 bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0ms' }} />
                <div className="w-0.5 bg-white rounded-full animate-pulse" style={{ height: '80%', animationDelay: '75ms' }} />
                <div className="w-0.5 bg-white rounded-full animate-pulse" style={{ height: '60%', animationDelay: '150ms' }} />
                <div className="w-0.5 bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '225ms' }} />
                <div className="w-0.5 bg-white rounded-full animate-pulse" style={{ height: '70%', animationDelay: '300ms' }} />
              </div>
            ) : (
              // Microphone icon
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* Text Input */}
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask to pay, split, or schedule..."
                disabled={disabled}
                className="w-full glass bg-slate-900/50 border-teal-400/30 text-slate-100 placeholder:text-slate-500 focus-visible:ring-teal-400 focus-visible:border-teal-400/50 rounded-2xl px-5 py-3 text-sm h-12 pr-24"
              />
              
              {/* Quick Actions inside input */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg glass bg-slate-800/50 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-teal-400 transition-colors"
                  title="Attach file"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </div>
            </div>

          {/* Send Button */}
          <Button
            type="submit"
            disabled={disabled || !input.trim()}
            className="flex-shrink-0 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-2xl px-6 h-12 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20"
          >
            {disabled ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};