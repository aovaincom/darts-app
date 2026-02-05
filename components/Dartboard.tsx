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

  // --- FLASH EFFECT (BOT & CLICK) ---
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

  // --- RENDERING ---
  const renderSectorButtons = () => {
      // SÄÄDÖT PALLOJEN SIJAINNILLE (Prosentteja keskipisteestä)
      const rDouble = 42; // Uloin rengas
      const rSingle = 28; // Keskirengas
      const rTriple = 15; // Sisin rengas

      // SÄÄDÖT PALLOJEN KOOLLE (% containerin leveydestä)
      const sDouble = 9;
      const sSingle = 13; // Single on isoin
      const sTriple = 9;

      return SECTORS.map((num, i) => {
          // Kulma: 20 on ylhäällä (-90 astetta)
          const angleDeg = (i * 18) - 90;
          const angleRad = angleDeg * (Math.PI / 180);

          // Värit: Parillinen indeksi (20, 18...) = Musta sektori
          const isBlackSector = i % 2 === 0;
          
          // Tyylit
          const styleSingle = isBlackSector 
            ? "bg-slate-900 border-slate-700 text-white" 
            : "bg-gray-100 border-gray-300 text-black";
            
          const styleRing = isBlackSector 
            ? "bg-red-600 border-red-800 text-white" 
            : "bg-green-600 border-green-800 text-white";

          // Sijaintilaskuri
          const getPosStyle = (radiusPct: number, sizePct: number) => ({
              top: `calc(50% + ${Math.sin(angleRad) * radiusPct}%)`,
              left: `calc(50% + ${Math.cos(angleRad) * radiusPct}%)`,
              width: `${sizePct}%`,
              height: `${sizePct}%`,
              transform: 'translate(-50%, -50%)',
          });

          // Yhteinen nappityyli
          const btnBase = "absolute rounded-full border-2 shadow-lg flex items-center justify-center font-bold z-10 transition-all active:scale-95 hover:brightness-110";
          const flashStyle = "bg-yellow-400 border-yellow-200 text-black scale-125 z-50 shadow-yellow-500/50";

          return (
              <React.Fragment key={num}>
                  {/* DOUBLE */}
                  <button
                      onClick={() => handleClick(num, 2)}
                      className={`${btnBase} text-[10px] sm:text-xs ${flashingBtn === `${num}-2` ? flashStyle : styleRing}`}
                      style={getPosStyle(rDouble, sDouble)}
                  >
                      D{num}
                  </button>

                  {/* SINGLE (ISO) */}
                  <button
                      onClick={() => handleClick(num, 1)}
                      className={`${btnBase} text-sm sm:text-base ${flashingBtn === `${num}-1` ? flashStyle : styleSingle}`}
                      style={getPosStyle(rSingle, sSingle)}
                  >
                      {num}
                  </button>

                  {/* TRIPLE */}
                  <button
                      onClick={() => handleClick(num, 3)}
                      className={`${btnBase} text-[10px] sm:text-xs ${flashingBtn === `${num}-3` ? flashStyle : styleRing}`}
                      style={getPosStyle(rTriple, sTriple)}
                  >
                      T{num}
                  </button>
              </React.Fragment>
          );
      });
  };

  return (
    <div className="w-full max-w-[800px] mx-auto p-2 flex flex-col items-center gap-4 select-none">
      
      {/* PELIALUE (SQUARE) */}
      <div className="relative w-full aspect-square bg-slate-800/30 rounded-full border-4 border-slate-800 shadow-2xl p-4">
          
          {/* KESKUSTAN LOGO */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-slate-900/50 rounded-full border border-slate-700/50 z-0"></div>

          {/* SEKTORIPALLOT */}
          {renderSectorButtons()}

          {/* ERIKOISNAPIT (KULMAT, MUTTA NYT SISÄLLYTETTY "TURVALLISEEN" ALUEESEEN TAI ERILLEEN) */}
          {/* Tässä versiossa laitan ne taulun kulmiin "kellumaan", kuten pyysit */}
          
          {/* MISS - Vasen Ylä */}
          <button 
            onClick={() => handleClick(0, 0)}
            className={`absolute top-0 left-0 w-[15%] h-[15%] rounded-full bg-slate-800 border-4 border-slate-600 flex items-center justify-center shadow-xl hover:bg-slate-700 active:scale-95 transition-all ${flashingBtn === '0-0' ? 'bg-red-500 border-white' : ''}`}
          >
              <span className="text-xs font-bold text-slate-400">MISS</span>
          </button>

          {/* 25 (OUTER) - Oikea Ylä */}
          <button 
            onClick={() => handleClick(25, 1)}
            className={`absolute top-0 right-0 w-[15%] h-[15%] rounded-full bg-green-700 border-4 border-green-900 flex items-center justify-center shadow-xl hover:bg-green-600 active:scale-95 transition-all ${flashingBtn === '25-1' ? 'bg-yellow-400 border-white text-black' : 'text-white'}`}
          >
              <span className="text-xs font-bold">25</span>
          </button>

          {/* BULL (50) - Oikea Ala */}
          <button 
            onClick={() => handleClick(50, 1)}
            className={`absolute bottom-0 right-0 w-[15%] h-[15%] rounded-full bg-red-700 border-4 border-red-900 flex items-center justify-center shadow-xl hover:bg-red-600 active:scale-95 transition-all ${flashingBtn === '50-1' ? 'bg-yellow-400 border-white text-black' : 'text-white'}`}
          >
              <span className="text-xs font-bold">BULL</span>
          </button>

           {/* INFO - Vasen Ala (Voi olla tyhjä tai joku muu toiminto) */}
           <div className="absolute bottom-0 left-0 w-[15%] h-[15%] flex items-center justify-center opacity-30">
               <span className="text-[10px] text-slate-500">🎯</span>
           </div>

      </div>
    </div>
  );
};