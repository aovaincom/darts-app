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
      // SÄÄDETYT ETÄISYYDET (Keskipisteestä)
      // Jotta kaikki 3 rengasta mahtuvat ja ovat yhtä isoja
      const rDouble = 44; // Uloin
      const rSingle = 31; // Keskellä
      const rTriple = 18; // Sisin

      // YHTENÄINEN KOKO KAIKILLE PALLOILLE
      const buttonSize = 11; // % taulun leveydestä

      return SECTORS.map((num, i) => {
          const angleDeg = (i * 18) - 90;
          const angleRad = angleDeg * (Math.PI / 180);

          // VÄRIT (Musta/Valkoinen sektori)
          // Indeksi 0 on 20 (Musta), 1 on 1 (Valkoinen) -> Parillinen=Musta
          const isBlackSector = i % 2 === 0; 
          
          // S = Musta/Valkoinen, D/T = Punainen/Vihreä
          const colorSingle = isBlackSector ? "bg-slate-900 border-slate-600 text-white" : "bg-slate-100 border-slate-300 text-slate-900";
          const colorRing = isBlackSector ? "bg-red-600 border-red-800 text-white" : "bg-green-600 border-green-800 text-white";

          const getStyle = (radius: number) => ({
              top: `calc(50% + ${Math.sin(angleRad) * radius}%)`,
              left: `calc(50% + ${Math.cos(angleRad) * radius}%)`,
              width: `${buttonSize}%`,
              height: `${buttonSize}%`,
              transform: 'translate(-50%, -50%)',
          });

          // Yhteiset tyylit kaikille napeille
          const baseBtnClass = "absolute rounded-full border-2 shadow-md flex items-center justify-center font-bold text-sm sm:text-base z-20 transition-transform active:scale-90 hover:brightness-110";

          return (
              <React.Fragment key={num}>
                  {/* DOUBLE */}
                  <button
                      onClick={() => handleClick(num, 2)}
                      className={`${baseBtnClass} ${flashingBtn === `${num}-2` ? 'bg-yellow-400 border-yellow-200 scale-125 z-50 text-black' : colorRing}`}
                      style={getStyle(rDouble)}
                  >
                      D{num}
                  </button>

                  {/* SINGLE */}
                  <button
                      onClick={() => handleClick(num, 1)}
                      className={`${baseBtnClass} ${flashingBtn === `${num}-1` ? 'bg-yellow-400 border-yellow-200 scale-125 z-50 text-black' : colorSingle}`}
                      style={getStyle(rSingle)}
                  >
                      {num}
                  </button>

                  {/* TRIPLE */}
                  <button
                      onClick={() => handleClick(num, 3)}
                      className={`${baseBtnClass} ${flashingBtn === `${num}-3` ? 'bg-yellow-400 border-yellow-200 scale-125 z-50 text-black' : colorRing}`}
                      style={getStyle(rTriple)}
                  >
                      T{num}
                  </button>
              </React.Fragment>
          );
      });
  };

  return (
    <div className="relative w-full max-w-[650px] aspect-square mx-auto select-none p-2">
      {/* TAUSTAYMPYRÄT KORISTEENA */}
      <div className="absolute inset-[2%] rounded-full border-4 border-slate-800 bg-slate-900/40 shadow-2xl"></div>
      <div className="absolute inset-[15%] rounded-full border border-slate-700/20"></div>
      <div className="absolute inset-[28%] rounded-full border border-slate-700/20"></div>
      <div className="absolute inset-[41%] rounded-full border border-slate-700/20"></div>
      
      {/* SEKTORIPALLOT */}
      {renderRadialButtons()}

      {/* --- KULMANAPIT (ISOJA JA HELPOSTI OSUTTAVIA) --- */}
      
      {/* MISS (Vasen Ylä) */}
      <button 
        onClick={() => handleClick(0, 0)}
        className={`absolute top-[2%] left-[2%] w-[16%] h-[16%] rounded-2xl border-4 border-slate-700 bg-slate-800 text-slate-500 font-bold text-sm sm:text-xl flex flex-col items-center justify-center hover:bg-slate-700 active:scale-95 transition-all shadow-lg z-30 ${flashingBtn === '0-0' ? 'bg-red-500 text-white border-red-400' : ''}`}
      >
          <span>MISS</span>
      </button>

      {/* OUTER BULL / 25 (Oikea Ylä) */}
      <button 
        onClick={() => handleClick(25, 1)}
        className={`absolute top-[2%] right-[2%] w-[16%] h-[16%] rounded-full border-4 border-green-700 bg-green-600 text-white font-bold text-sm sm:text-xl flex flex-col items-center justify-center hover:bg-green-500 active:scale-95 transition-all shadow-lg z-30 ${flashingBtn === '25-1' ? 'bg-yellow-400 border-yellow-200 text-black' : ''}`}
      >
          <span>25</span>
      </button>

      {/* INNER BULL / 50 (Oikea Ala) */}
      <button 
        onClick={() => handleClick(50, 1)}
        className={`absolute bottom-[2%] right-[2%] w-[16%] h-[16%] rounded-full border-4 border-red-700 bg-red-600 text-white font-bold text-sm sm:text-xl flex flex-col items-center justify-center hover:bg-red-500 active:scale-95 transition-all shadow-lg z-30 ${flashingBtn === '50-1' ? 'bg-yellow-400 border-yellow-200 text-black' : ''}`}
      >
          <span>BULL</span>
      </button>

      {/* KESKUSTEKSTI (LOGO) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[14%] h-[14%] bg-slate-800/80 backdrop-blur rounded-full border-2 border-slate-700 flex items-center justify-center z-10 shadow-inner">
          <span className="text-slate-500 text-[10px] sm:text-xs font-bold tracking-widest">DARTS</span>
      </div>

    </div>
  );
};