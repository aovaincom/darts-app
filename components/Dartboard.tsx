"use client";

import React, { useRef, useState, useEffect } from "react";

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

interface DartboardProps {
  onThrow: (score: number, multiplier: number) => void;
  currentUserId?: number; 
  highlight?: { score: number; multiplier: number } | null; // UUSI: Botin heitto
}

export const Dartboard: React.FC<DartboardProps> = ({ onThrow, currentUserId, highlight }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [lastHit, setLastHit] = useState<string | null>(null);
  const [hitPoint, setHitPoint] = useState<{x: number, y: number} | null>(null);
  const [flashingSector, setFlashingSector] = useState<string | null>(null);

  // Tyhjennetään viimeinen heitto, kun vuoro vaihtuu
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

  // --- UUSI: VISUALISOI BOTIN HEITTO ---
  useEffect(() => {
    if (highlight) {
        const { score, multiplier } = highlight;
        const id = `${score}-${multiplier}`;
        
        // 1. Aseta välkkyvä sektori
        setFlashingSector(id);
        
        // 2. Päivitä tekstikenttä taulun alla
        const label = score === 25 
            ? (multiplier === 2 ? 'BULL' : '25') 
            : (score === 50 ? 'BULL' : `${multiplier > 1 ? (multiplier === 3 ? 'T' : 'D') : ''}${score}`);
            
        setLastHit(label);
        
        // 3. Soita ääni
        playHitSound();
    }
  }, [highlight]);

  // --- ÄÄNILOGIIKKA ---
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

    const R_BULL = 12;
    const R_OUTER_BULL = 30;
    const R_TRIPLE_IN = 95;
    const R_TRIPLE_OUT = 115;
    const R_DOUBLE_IN = 160;
    const R_DOUBLE_OUT = 180;

    if (r < R_BULL) {
      score = 50; multiplier = 1; // Inner Bull on teknisesti double 25 säännöissä, mutta usein merkitään 50-1 tai 25-2
    } else if (r < R_OUTER_BULL) {
      score = 25; multiplier = 1;
    } else if (r > R_DOUBLE_OUT) {
      score = 0; multiplier = 0; 
    } else {
      const sectorIndex = Math.floor(((angle + 9) % 360) / 18);
      score = SECTORS[sectorIndex];

      if (r >= R_TRIPLE_IN && r <= R_TRIPLE_OUT) multiplier = 3;
      else if (r >= R_DOUBLE_IN && r <= R_DOUBLE_OUT) multiplier = 2;
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
      const baseSectorColor = isEven ? "#000000" : "#f1ebd4";
      const baseRingColor = isEven ? "#e11d48" : "#10b981";

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
                key={id} 
                d={d} 
                fill={isFlashing ? "#fbbf24" : color} 
                strokeWidth="1" 
                stroke="#555" 
                style={{ transition: "fill 0.1s ease-out", filter: isFlashing ? "brightness(1.5)" : "none" }}
            />
        );
      };

      paths.push(createArc(30, 160, baseSectorColor, 1)); 
      paths.push(createArc(95, 115, baseRingColor, 3));
      paths.push(createArc(160, 180, baseRingColor, 2));
    }
    return paths;
  };

  const renderNumbers = () => {
    return SECTORS.map((num, i) => {
      const angleFromTop = i * 18;
      const pos = getCoordinates(angleFromTop, 195);
      let rotation = angleFromTop;
      if (angleFromTop > 90 && angleFromTop < 270) {
        rotation += 180;
      }

      return (
        <text
          key={`num-${num}`}
          x={pos.x}
          y={pos.y}
          fill="#fff"
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
    <div className="flex flex-col items-center">
      <div className="relative drop-shadow-2xl">
        <svg
          ref={svgRef}
          width="400"
          height="400"
          viewBox="-230 -230 460 460"
          onClick={handleClick}
          className="cursor-pointer select-none"
        >
          <circle r="205" fill="#18181b" />
          {renderSectors()}
          
          <circle 
            r="30" 
            fill={flashingSector === "25-1" ? "#fbbf24" : "#10b981"} 
            stroke="#555" 
            strokeWidth="1" 
            style={{ transition: "fill 0.1s", filter: flashingSector === "25-1" ? "brightness(1.5)" : "none" }}
          />
          <circle 
            r="12" 
            fill={flashingSector === "50-1" ? "#fbbf24" : "#e11d48"} 
            stroke="#555" 
            strokeWidth="1" 
            style={{ transition: "fill 0.1s", filter: flashingSector === "50-1" ? "brightness(1.5)" : "none" }}
          />

          {renderNumbers()}

          {hitPoint && (
            <circle 
              cx={hitPoint.x} 
              cy={hitPoint.y} 
              r="6" 
              fill="#fbbf24"
              stroke="white"
              strokeWidth="2"
              className="animate-ping origin-center opacity-75"
            />
          )}
        </svg>
      </div>

      <div className="mt-4 text-2xl font-bold font-mono text-orange-500 h-8 transition-opacity duration-300">
        {lastHit || " "} 
      </div>
    </div>
  );
};