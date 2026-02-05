"use client";

import React, { useState, useEffect } from "react";

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

interface DartboardProps {
  onThrow: (score: number, multiplier: number) => void;
  currentUserId?: number; 
  highlight?: { score: number; multiplier: number } | null;
}

export const Dartboard: React.FC<DartboardProps> = ({ onThrow, highlight }) => {
  const [flashingBtn, setFlashingBtn] = useState<string | null>(null);

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

  const renderSectorButtons = () => {
      const rDouble = 44; 
      const rSingle = 31; 
      const rTriple = 18; 
      const buttonSize = 10; 

      return SECTORS.map((num, i) => {
          const angleDeg = (i * 18) - 90;
          const angleRad = angleDeg * (Math.PI / 180);
          const isBlackSector = i % 2 === 0;
          
          const styleSingle = isBlackSector 
            ? "bg-slate-900 border-slate-600 text-white" 
            : "bg-slate-100 border-slate-300 text-black";
            
          const styleRing = isBlackSector 
            ? "bg-red-600 border-red-800 text-white" 
            : "bg-green-600 border-green-800 text-white";

          const getPosStyle = (radiusPct: number) => ({
              top: `calc(50% + ${Math.sin(angleRad) * radiusPct}%)`,
              left: `calc(50% + ${Math.cos(angleRad) * radiusPct}%)`,
              width: `${buttonSize}%`,
              height: `${buttonSize}%`,
              transform: 'translate(-50%, -50%)',
          });

          const btnBase = "absolute rounded-full border shadow-md flex items-center justify-center font-bold z-10 transition-transform active:scale-95";
          const flashStyle = "bg-yellow-400 border-yellow-200 text-black scale-125 z-50 shadow-yellow-500/50";
          const fontSizeClass = "text-[2.5vmin] sm:text-[2vmin] font-bold";

          return (
              <React.Fragment key={num}>
                  <button onClick={() => handleClick(num, 2)} className={`${btnBase} ${fontSizeClass} ${flashingBtn === `${num}-2` ? flashStyle : styleRing}`} style={getPosStyle(rDouble)}>D{num}</button>
                  <button onClick={() => handleClick(num, 1)} className={`${btnBase} ${fontSizeClass} ${flashingBtn === `${num}-1` ? flashStyle : styleSingle}`} style={getPosStyle(rSingle)}>{num}</button>
                  <button onClick={() => handleClick(num, 3)} className={`${btnBase} ${fontSizeClass} ${flashingBtn === `${num}-3` ? flashStyle : styleRing}`} style={getPosStyle(rTriple)}>T{num}</button>
              </React.Fragment>
          );
      });
  };

  return (
    // TÄRKEÄ MUUTOS: w-full varmistaa leveyden, max-w säätää maksimin
    <div className="relative w-full h-full flex items-center justify-center select-none p-2">
      <div className="relative w-full max-w-[90vmin] aspect-square bg-slate-800/40 rounded-full border-4 border-slate-800 shadow-2xl">
          {/* CENTER HOLE */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[16%] h-[16%] bg-slate-900/60 rounded-full border border-slate-700/50 z-0"></div>

          {renderSectorButtons()}

          {/* CORNER BUTTONS */}
          <button onClick={() => handleClick(0, 0)} className={`absolute top-[2%] left-[2%] w-[14%] h-[14%] rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-lg active:scale-95 transition-all z-40 ${flashingBtn === '0-0' ? 'bg-red-500 border-white' : ''}`}>
              <span className="text-[2.5vmin] font-bold text-slate-400">0</span>
          </button>
          <button onClick={() => handleClick(25, 1)} className={`absolute top-[2%] right-[2%] w-[14%] h-[14%] rounded-full bg-green-700 border-2 border-green-900 flex items-center justify-center shadow-lg active:scale-95 transition-all z-40 ${flashingBtn === '25-1' ? 'bg-yellow-400 border-white text-black' : 'text-white'}`}>
              <span className="text-[2.5vmin] font-bold">25</span>
          </button>
          <button onClick={() => handleClick(50, 1)} className={`absolute bottom-[2%] right-[2%] w-[14%] h-[14%] rounded-full bg-red-700 border-2 border-red-900 flex items-center justify-center shadow-lg active:scale-95 transition-all z-40 ${flashingBtn === '50-1' ? 'bg-yellow-400 border-white text-black' : 'text-white'}`}>
              <span className="text-[2.5vmin] font-bold">50</span>
          </button>
      </div>
    </div>
  );
};