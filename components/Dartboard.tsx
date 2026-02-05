"use client";

import React, { useRef, useState, useEffect } from "react";

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

interface DartboardProps {
  onThrow: (score: number, multiplier: number) => void;
  currentUserId?: number; 
  highlight?: { score: number; multiplier: number } | null;
}

export const Dartboard: React.FC<DartboardProps> = ({ onThrow, currentUserId, highlight }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [lastHit, setLastHit] = useState<string | null>(null);
  const [hitPoint, setHitPoint] = useState<{x: number, y: number} | null>(null);
  const [flashingSector, setFlashingSector] = useState<string | null>(null);

  // UUSI GEOMETRIA (Tasa-arvoiset renkaat)
  // Kokonaissäde 200 yksikköä
  const R_BULL = 15;          // Hieman isompi
  const R_OUTER_BULL = 35;    // Hieman isompi
  
  // Lasketaan lopputila (200 - 35 = 165). Jaetaan tasan 4 vyöhykkeelle (Inner Single, Triple, Outer Single, Double)
  const ZONE_WIDTH = 41.25; 
  
  const R_INNER_SINGLE = R_OUTER_BULL + ZONE_WIDTH; // 35 + 41.25 = 76.25
  const R_TRIPLE = R_INNER_SINGLE + ZONE_WIDTH;     // 76.25 + 41.25 = 117.5
  const R_OUTER_SINGLE = R_TRIPLE + ZONE_WIDTH;     // 117.5 + 41.25 = 158.75
  const R_DOUBLE = R_OUTER_SINGLE + ZONE_WIDTH;     // 158.75 + 41.25 = 200

  useEffect(() => {
    setLastHit(null);
  }, [currentUserId]);

  useEffect(() => {
    if (hitPoint) {
      const timer = setTimeout(() => setHitPoint(null), 300);
      return () => clearTimeout(timer);
    }
  }, [hitPoint]);

  useEffect(() => {
    if (flashingSector) {
      const timer = setTimeout(() => setFlashingSector(null), 200);
      return () => clearTimeout(timer);
    }
  }, [flashingSector]);

  useEffect(() => {
    if (highlight) {
        const { score, multiplier } = highlight;
        const id = `${score}-${multiplier}`;
        setFlashingSector(id);
        const label = score === 25 
            ? (multiplier === 2 ? 'BULL' : '25') 
            : (score === 50 ? 'BULL' : `${multiplier > 1 ? (multiplier === 3 ? 'T' : 'D') : ''}${score}`);
        setLastHit(label);
        playHitSound();
    }
  }, [highlight]);

  const playHitSound = () => {
    try {
        const audio = new Audio('/sounds/dart-throw.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log("Audio play prevented:", e));
    } catch (e) {
        console.error("Audio error", e);
    }
  };

  const getCoordinates = (degree: number, radius: number) => {
    const radians = (degree - 90) * (Math.PI / 180); 
    return {
      x: Math.cos(radians) * radius,
      y: Math.sin(radians) * radius,
    };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    playHitSound();

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const scaleFactor = 460 / rect.width; 
    const svgX = x * scaleFactor;
    const svgY = y * scaleFactor;
    setHitPoint({ x: svgX, y: svgY });

    const r = Math.sqrt(svgX * svgX + svgY * svgY);
    let angle = (Math.atan2(svgY, svgX) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    let multiplier = 0;
    let score = 0;

    // UUSI OSUMALOGIIKKA (Vastaa uutta geometriaa)
    if (r < R_BULL) {
      score = 50; multiplier = 1;
    } else if (r < R_OUTER_BULL) {
      score = 25; multiplier = 1;
    } else if (r > R_DOUBLE) {
      score = 0; multiplier = 0; 
    } else {
      const sectorIndex = Math.floor(((angle + 9) % 360) / 18);
      score = SECTORS[sectorIndex];

      if (r >= R_INNER_SINGLE && r <= R_TRIPLE) multiplier = 3;
      else if (r >= R_OUTER_SINGLE && r <= R_DOUBLE) multiplier = 2;
      else multiplier = 1;
    }

    if (multiplier > 0) {
        setFlashingSector(`${score}-${multiplier}`);
    }

    setLastHit(`${multiplier > 1 ? (multiplier === 3 ? 'T' : 'D') : ''}${score === 25 ? '25' : (score === 50 ? 'BULL' : score)}`);
    onThrow(score, multiplier);
  };

  const renderSectors = () => {
    const paths = [];
    for (let i = 0; i < 20; i++) {
      const number = SECTORS[i];
      const startAngle = i * 18 - 9;
      const endAngle = startAngle + 18;
      
      const isEven = i % 2 === 0;
      const baseSectorColor = isEven ? "#0f172a" : "#f1f5f9"; // Tumma (Slate-900) vs Vaalea (Slate-100)
      const baseRingColor = isEven ? "#ef4444" : "#22c55e"; // Punainen vs Vihreä

      const createArc = (innerR: number, outerR: number, color: string, mult: number) => {
        const start = getCoordinates(startAngle, outerR);
        const end = getCoordinates(endAngle, outerR);
        const startInner = getCoordinates(startAngle, innerR);
        const endInner = getCoordinates(endAngle, innerR);
        
        const id = `${number}-${mult}`;
        const isFlashing = flashingSector === id;

        const d = `
          M ${start.x} ${start.y}
          A ${outerR} ${outerR} 0 0 1 ${end.x} ${end.y}
          L ${endInner.x} ${endInner.y}
          A ${innerR} ${innerR} 0 0 0 ${startInner.x} ${startInner.y}
          Z
        `;
        return (
            <path 
                key={`${id}-${innerR}`} // Unique key
                d={d} 
                fill={isFlashing ? "#fbbf24" : color} 
                strokeWidth="1" 
                stroke="#334155" // Hieman vaaleampi viiva
                style={{ transition: "fill 0.1s ease-out", filter: isFlashing ? "brightness(1.5)" : "none" }}
            />
        );
      };

      // PIIRRETÄÄN VYÖHYKKEET (Järjestys: Sisältä ulos)
      // 1. Inner Single
      paths.push(createArc(R_OUTER_BULL, R_INNER_SINGLE, baseSectorColor, 1));
      // 2. Triple (Nyt iso!)
      paths.push(createArc(R_INNER_SINGLE, R_TRIPLE, baseRingColor, 3));
      // 3. Outer Single
      paths.push(createArc(R_TRIPLE, R_OUTER_SINGLE, baseSectorColor, 1));
      // 4. Double (Nyt iso!)
      paths.push(createArc(R_OUTER_SINGLE, R_DOUBLE, baseRingColor, 2));
    }
    return paths;
  };

  const renderNumbers = () => {
    return SECTORS.map((num, i) => {
      const angleFromTop = i * 18;
      // Numerot vähän ulommas (R_DOUBLE + 20)
      const pos = getCoordinates(angleFromTop, R_DOUBLE + 20);
      let rotation = angleFromTop;
      if (angleFromTop > 90 && angleFromTop < 270) {
        rotation += 180;
      }

      return (
        <text
          key={`num-${num}`}
          x={pos.x}
          y={pos.y}
          fill="#94a3b8" // Slate-400 (hillitty numero)
          fontSize="24"
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          textAnchor="middle"
          alignmentBaseline="middle"
          transform={`rotate(${rotation}, ${pos.x}, ${pos.y})`} 
        >
          {num}
        </text>
      );
    });
  };

  return (
    <div className="flex flex-col items-center w-full h-full">
      {/* VIEWBOX kasvatettu (-260), jotta numerot mahtuvat varmasti. 
         Koko skaalautuu parentin mukaan (w-full).
      */}
      <div className="relative drop-shadow-2xl w-full h-full">
        <svg
          ref={svgRef}
          viewBox="-260 -260 520 520" 
          onClick={handleClick}
          className="cursor-pointer select-none w-full h-auto max-h-[80vh]" // max-h varmistaa ettei mene ruudun yli pystysuunnassa
        >
          {/* Tausta (musta ympyrä numeroiden taakse) */}
          <circle r={R_DOUBLE + 35} fill="#0f172a" /> 
          
          {renderSectors()}
          
          {/* Outer Bull */}
          <circle 
            r={R_OUTER_BULL} 
            fill={flashingSector === "25-1" ? "#fbbf24" : "#10b981"} 
            stroke="#334155" 
            strokeWidth="1" 
            style={{ transition: "fill 0.1s", filter: flashingSector === "25-1" ? "brightness(1.5)" : "none" }}
          />
          {/* Inner Bull */}
          <circle 
            r={R_BULL} 
            fill={flashingSector === "50-1" ? "#fbbf24" : "#e11d48"} 
            stroke="#334155" 
            strokeWidth="1" 
            style={{ transition: "fill 0.1s", filter: flashingSector === "50-1" ? "brightness(1.5)" : "none" }}
          />

          {renderNumbers()}

          {hitPoint && (
            <circle 
              cx={hitPoint.x} 
              cy={hitPoint.y} 
              r="8" 
              fill="#fbbf24"
              stroke="white"
              strokeWidth="2"
              className="animate-ping origin-center opacity-75"
            />
          )}
        </svg>
      </div>

      <div className="mt-2 text-3xl font-black font-mono text-orange-500 h-10 transition-opacity duration-300 drop-shadow-md">
        {lastHit || " "} 
      </div>
    </div>
  );
};