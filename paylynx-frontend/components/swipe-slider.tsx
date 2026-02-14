'use client';

import React from "react"

import { useState, useRef } from 'react';

interface SwipeSliderProps {
  onConfirm: () => void;
  isProcessing: boolean;
}

export const SwipeSlider: React.FC<SwipeSliderProps> = ({ onConfirm, isProcessing }) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !sliderRef.current || isProcessing) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const newX = Math.min(Math.max(0, e.clientX - rect.left - 20), rect.width - 40);
    setDragX(newX);

    if (newX > rect.width - 60) {
      setIsDragging(false);
      onConfirm();
      setDragX(0);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragX(0);
  };

  return (
    <div
      ref={sliderRef}
      className="relative w-full h-14 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border-2 border-teal-400/50 rounded-full flex items-center select-none glow-primary overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Slider Background Fill */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-teal-500/30 to-emerald-500/30 transition-all duration-100"
        style={{ width: `${(dragX / (sliderRef.current?.offsetWidth || 1)) * 100}%` }}
      />

      {/* Slider Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-sm font-semibold transition-opacity duration-200 ${
          dragX > (sliderRef.current?.offsetWidth || 0) * 0.3 ? 'opacity-0' : 'opacity-100 text-slate-300'
        }`}>
          Swipe to Confirm
        </span>
      </div>

      {/* Draggable Thumb */}
      <div
        className="absolute left-1 h-12 w-12 bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center glow-primary transition-shadow"
        style={{
          transform: `translateX(${dragX}px)`,
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
      >
        <svg className="w-5 h-5 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>

      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-full">
          <div className="animate-spin">
            <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};
