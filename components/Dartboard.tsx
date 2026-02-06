"use client";

import React, { useState, useEffect } from "react";

interface DartboardProps {
  onThrow: (score: number, multiplier: number) => void;
  currentUserId?: number; 
  highlight?: { score: number; multiplier: number } | null;
}

export const Dartboard: React.FC<DartboardProps> = ({ onThrow, highlight }) => {
  const [flashingBtn, setFlashingBtn] = useState<string | null>(null);

  // Numerot 20-1
  const NUMBERS = Array.from({ length: 20 }, (_, i) => 20 - i);

  useEffect(() => {
    if (highlight) {
        const { score, multiplier } = highlight;
        const id = `${score}-${multiplier}`;
        triggerFlash(id);
        playHitSound();
    }
  }, [highlight]);

  const triggerFlash = (id: string) => {
      setFlashingBtn(id);
      setTimeout(() => setFlashingBtn(null), 200);
  };

  const playHitSound = () => {
    try {
        const audio = new Audio('/sounds/dart-throw.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
    } catch (e) {}
  };

  const handleClick = (score: number, multiplier: number) => {
    playHitSound();
    triggerFlash(`${score}-${multiplier}`);
    onThrow(score, multiplier);
  };

  const getButtonColor = (num: number, type: 'single' | 'ring') => {
      // Dartboard värisäännöt:
      // 20 (Parillinen) -> Musta/Punainen
      // 19 (Pariton) -> Valkoinen/Vihreä
      const isEven = num % 2 === 0;
      
      if (type === 'single') {
          return isEven 
            ? "bg-slate-900 text-white border-slate-700" 
            : "bg-slate-100 text-black border-slate-300";
      } else {
          return isEven
            ? "bg-red-600 text-white border-red-800"
            : "bg-green-600 text-white border-green-800";
      }
  };

  const FlashStyle = "bg-yellow-400 border-yellow-200 text-black !scale-105 z-50 brightness-110";

  return (
    <div className="w-full h-full flex flex-col gap-2 p-1 select-none overflow-y-auto">
      
      {/* --- HEADER: MISS & BULLS --- */}
      <div className="flex w-full gap-2 h-[12vh] min-h-[60px]">
          <button 
            onClick={() => handleClick(0, 0)}
            className={`flex-1 rounded-xl border-4 border-slate-600 bg-slate-800 text-slate-400 font-bold text-xl flex items-center justify-center active:scale-95 transition-all ${flashingBtn === '0-0' ? 'bg-red-500 text-white border-white' : ''}`}
          >
              MISS
          </button>
          <button 
            onClick={() => handleClick(25, 1)}
            className={`flex-1 rounded-xl border-4 border-green-800 bg-green-600 text-white font-bold text-xl flex items-center justify-center active:scale-95 transition-all ${flashingBtn === '25-1' ? FlashStyle : ''}`}
          >
              25
          </button>
          <button 
            onClick={() => handleClick(50, 1)}
            className={`flex-1 rounded-xl border-4 border-red-800 bg-red-600 text-white font-bold text-xl flex items-center justify-center active:scale-95 transition-all ${flashingBtn === '50-1' ? FlashStyle : ''}`}
          >
              BULL
          </button>
      </div>

      {/* --- MAIN GRID --- */}
      {/* Käytetään CSS Gridiä joka skaalautuu ruudun koon mukaan */}
      <div className="flex-1 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2">
          {NUMBERS.map(num => (
              <div key={num} className="flex flex-col gap-1 h-full min-h-[120px]">
                  
                  {/* TRIPLE (Ylin) */}
                  <button
                      onClick={() => handleClick(num, 3)}
                      className={`h-1/4 w-full rounded border-2 font-bold text-sm flex items-center justify-center active:scale-95 transition-all ${flashingBtn === `${num}-3` ? FlashStyle : getButtonColor(num, 'ring')}`}
                  >
                      T{num}
                  </button>

                  {/* SINGLE (Keskellä, Isoin) */}
                  <button
                      onClick={() => handleClick(num, 1)}
                      className={`flex-1 w-full rounded border-2 font-bold text-2xl flex items-center justify-center active:scale-95 transition-all ${flashingBtn === `${num}-1` ? FlashStyle : getButtonColor(num, 'single')}`}
                  >
                      {num}
                  </button>

                  {/* DOUBLE (Alin) */}
                  <button
                      onClick={() => handleClick(num, 2)}
                      className={`h-1/4 w-full rounded border-2 font-bold text-sm flex items-center justify-center active:scale-95 transition-all ${flashingBtn === `${num}-2` ? FlashStyle : getButtonColor(num, 'ring')}`}
                  >
                      D{num}
                  </button>

              </div>
          ))}
      </div>
    </div>
  );
};