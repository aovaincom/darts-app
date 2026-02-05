"use client";

import React, { useState, useEffect } from "react";

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

interface DartboardProps {
  onThrow: (score: number, multiplier: number) => void;
  currentUserId?: number; 
  highlight?: { score: number; multiplier: number } | null;
}

export const Dartboard: React.FC<DartboardProps> = ({ onThrow, currentUserId, highlight }) => {
  const [flashingBtn, setFlashingBtn] = useState<string | null>(null);

  // --- FLASH EFFECT ---
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

  // --- RENDER HELPERS ---
  const renderRadialButtons = () => {
      // Säde (etäisyys keskipisteestä)
      const rDouble = 46; // % containerista
      const rSingle = 34; 
      const rTriple = 22; 

      return SECTORS.map((num, i) => {
          // Lasketaan kulma: 20 on ylhäällä (-90 astetta), sektorit 18 asteen välein myötäpäivään
          const angleDeg = (i * 18) - 90;
          const angleRad = angleDeg * (Math.PI / 180);

          // Värit (Standardi Dartboard)
          // 20 on Musta sektori -> Single=Musta, D/T=Punainen
          // 1 on Valkoinen sektori -> Single=Valkoinen, D/T=Vihreä
          const isBlackSector = i % 2 === 0; // Tässä taulukossa parilliset indeksit (20, 18, 13...) ovat mustia
          
          // Korjaus: SECTORS-listassa 20 on indeksi 0 (parillinen). 
          // Oikea järjestys väreille: 20(B), 1(W), 18(B), 4(W)...
          // Joten parilliset indeksit = Musta sektori, Parittomat = Valkoinen
          
          const colorSingle = isBlackSector ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-100 border-slate-300 text-black";
          const colorRing = isBlackSector ? "bg-red-600 border-red-800 text-white" : "bg-green-600 border-green-800 text-white";

          // Sijoittelu (prosentteina keskeltä 50%)
          const getStyle = (radius: number, size: number) => ({
              top: `calc(50% + ${Math.sin(angleRad) * radius}%)`,
              left: `calc(50% + ${Math.cos(angleRad) * radius}%)`,
              width: `${size}%`,
              height: `${size}%`,
              transform: 'translate(-50%, -50%)',
          });

          return (
              <React.Fragment key={num}>
                  {/* DOUBLE (Uloin) */}
                  <button
                      onClick={() => handleClick(num, 2)}
                      className={`absolute rounded-full border shadow-sm flex items-center justify-center font-bold text-[10px] sm:text-xs z-30 transition-transform active:scale-90 ${flashingBtn === `${num}-2` ? 'bg-yellow-400 border-yellow-200 scale-110' : colorRing}`}
                      style={getStyle(rDouble, 8)}
                  >
                      D{num}
                  </button>

                  {/* SINGLE (Keskellä, isoin) */}
                  <button
                      onClick={() => handleClick(num, 1)}
                      className={`absolute rounded-full border-2 shadow-md flex items-center justify-center font-bold text-sm sm:text-lg z-20 transition-transform active:scale-90 ${flashingBtn === `${num}-1` ? 'bg-yellow-400 border-yellow-200 scale-110 text-black' : colorSingle}`}
                      style={getStyle(rSingle, 13)}
                  >
                      {num}
                  </button>

                  {/* TRIPLE (Sisin) */}
                  <button
                      onClick={() => handleClick(num, 3)}
                      className={`absolute rounded-full border shadow-sm flex items-center justify-center font-bold text-[10px] sm:text-xs z-30 transition-transform active:scale-90 ${flashingBtn === `${num}-3` ? 'bg-yellow-400 border-yellow-200 scale-110' : colorRing}`}
                      style={getStyle(rTriple, 8)}
                  >
                      T{num}
                  </button>
              </React.Fragment>
          );
      });
  };

  return (
    <div className="relative w-full max-w-[500px] aspect-square mx-auto select-none">
      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0 rounded-full border-[20px] border-slate-800 bg-slate-900/50 shadow-2xl"></div>
      <div className="absolute inset-[10%] rounded-full border border-slate-700/30"></div>
      
      {/* RADIAL BUTTONS */}
      {renderRadialButtons()}

      {/* --- CORNER BUTTONS (SPECIALS) --- */}
      
      {/* MISS (Top Left) */}
      <button 
        onClick={() => handleClick(0, 0)}
        className={`absolute top-0 left-0 w-[18%] h-[18%] rounded-2xl border-4 border-slate-700 bg-slate-800 text-slate-500 font-bold text-xs sm:text-sm flex flex-col items-center justify-center hover:bg-slate-700 active:scale-95 transition-all shadow-lg ${flashingBtn === '0-0' ? 'bg-red-500 text-white border-red-400' : ''}`}
      >
          <span>MISS</span>
          <span className="text-[10px] opacity-50">0</span>
      </button>

      {/* OUTER BULL (25) (Top Right) */}
      <button 
        onClick={() => handleClick(25, 1)}
        className={`absolute top-0 right-0 w-[18%] h-[18%] rounded-full border-4 border-green-700 bg-green-600 text-white font-bold text-xs sm:text-sm flex flex-col items-center justify-center hover:bg-green-500 active:scale-95 transition-all shadow-lg ${flashingBtn === '25-1' ? 'bg-yellow-400 border-yellow-200' : ''}`}
      >
          <span>25</span>
      </button>

      {/* INNER BULL (50) (Bottom Right) */}
      <button 
        onClick={() => handleClick(50, 1)} // Tai 25-2 logiikasta riippuen, yleensä 50-1 dartbotissa
        className={`absolute bottom-0 right-0 w-[18%] h-[18%] rounded-full border-4 border-red-700 bg-red-600 text-white font-bold text-xs sm:text-sm flex flex-col items-center justify-center hover:bg-red-500 active:scale-95 transition-all shadow-lg ${flashingBtn === '50-1' ? 'bg-yellow-400 border-yellow-200' : ''}`}
      >
          <span>BULL</span>
          <span className="text-[10px]">50</span>
      </button>

      {/* INFO TEXT CENTER (Optional decoration) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-slate-900 rounded-full border-4 border-slate-700 flex items-center justify-center z-10 shadow-inner">
          <span className="text-slate-600 text-[10px] font-bold">DARTS</span>
      </div>

    </div>
  );
};