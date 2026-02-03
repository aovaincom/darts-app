import { useState, useEffect, useCallback } from 'react';
import { SavedProfile } from './useProfiles';
import { getBotTurn } from '../utils/dartbot';

type Throw = {
  score: number;
  multiplier: number;
  totalValue: number;
};

export type PlayerStats = {
  average: number;
  totalScore: number;
  totalDarts: number;
  highestCheckout: number;
  scores60plus: number;
  scores80plus: number;
  scores100plus: number;
  scores120plus: number;
  scores140plus: number;
  scores180: number;
  tonPlusFinishes: number;
  rtcTargetsHit: number; 
  rtcDartsThrown: number;
  rtcSectorHistory: Record<string, { attempts: number; hits: number }>; 
};

export type PlayerState = {
  id: number;
  profileId?: string;
  name: string;
  isBot: boolean;
  botSkill: number;
  scoreLeft: number; 
  rtcTarget: number; 
  rtcFinished: boolean;
  setsWon: number;
  legsWon: number;
  history: Throw[];
  currentVisit: Throw[];
  stats: PlayerStats;
};

export type GameMode = 'x01' | 'rtc';

export type GameSettings = {
  gameMode: GameMode;
  startScore: 301 | 501 | 701;
  doubleIn: boolean;
  doubleOut: boolean;
  playerCount: number;
  matchMode: 'legs' | 'sets';
  targetToWin: number;
  legsPerSet: number;
  rtcIncludeBull: boolean; 
};

export type MatchResult = {
  winner: PlayerState;
  players: PlayerState[];
  mode: GameMode;
} | null;

type GameHistoryState = {
    players: PlayerState[];
    currentPlayerIndex: number;
    legStarterIndex: number;
    setStarterIndex: number;
};

export const useGameLogic = (settings: GameSettings, selectedProfiles: SavedProfile[], botConfig?: {count: number, skill: number}) => {
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [legStarterIndex, setLegStarterIndex] = useState(0);
  const [setStarterIndex, setSetStarterIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult>(null);
  const [historyStack, setHistoryStack] = useState<GameHistoryState[]>([]);

  // 1. ALUSTUS
  useEffect(() => {
    const createPlayer = (id: number, name: string, isBot: boolean, skill: number, profileId?: string): PlayerState => ({
      id, profileId, name, isBot, botSkill: skill,
      scoreLeft: settings.startScore,
      rtcTarget: 1, rtcFinished: false,
      setsWon: 0, legsWon: 0,
      history: [], currentVisit: [],
      stats: { average: 0, totalScore: 0, totalDarts: 0, highestCheckout: 0, scores60plus: 0, scores80plus: 0, scores100plus: 0, scores120plus: 0, scores140plus: 0, scores180: 0, tonPlusFinishes: 0, rtcTargetsHit: 0, rtcDartsThrown: 0, rtcSectorHistory: {} }
    });

    const humanPlayers = selectedProfiles.map((profile, index) => createPlayer(index, profile.name, false, 0, profile.id));
    const bots = [];
    if (botConfig && botConfig.count > 0) {
        for (let i = 0; i < botConfig.count; i++) {
            bots.push(createPlayer(humanPlayers.length + i, `Dartbot ${i+1}`, true, botConfig.skill));
        }
    }

    setPlayers([...humanPlayers, ...bots]);
    setCurrentPlayerIndex(0); 
    setLegStarterIndex(0);
    setSetStarterIndex(0);
    setMatchResult(null);
    setIsProcessing(false);
    setHistoryStack([]);
  }, [selectedProfiles, settings.startScore, settings.gameMode, settings.rtcIncludeBull, botConfig]);

  // 2. APUFUNKTIOT
  const saveStateToHistory = () => {
      setHistoryStack(prev => [...prev, { players: JSON.parse(JSON.stringify(players)), currentPlayerIndex, legStarterIndex, setStarterIndex }]);
  };

  const undoLastThrow = () => {
      if (historyStack.length === 0 || isProcessing || matchResult) return;
      const prev = historyStack[historyStack.length - 1];
      setPlayers(prev.players);
      setCurrentPlayerIndex(prev.currentPlayerIndex);
      setLegStarterIndex(prev.legStarterIndex);
      setSetStarterIndex(prev.setStarterIndex);
      setHistoryStack(h => h.slice(0, -1));
  };

  const updateStats = (player: PlayerState, visitTotal: number, dartsThrown: number, isCheckout: boolean) => {
    const s = { ...player.stats };
    if (settings.gameMode === 'x01') {
        s.totalScore += visitTotal;
        s.totalDarts += dartsThrown;
        s.average = s.totalDarts > 0 ? parseFloat(((s.totalScore / s.totalDarts) * 3).toFixed(2)) : 0;
        if (visitTotal === 180) s.scores180++;
        else if (visitTotal >= 140) s.scores140plus++;
        else if (visitTotal >= 100) s.scores100plus++;
        else if (visitTotal >= 60) s.scores60plus++;
        if (isCheckout) {
          if (visitTotal > s.highestCheckout) s.highestCheckout = visitTotal;
          if (visitTotal >= 100) s.tonPlusFinishes++;
        }
    }
    return s;
  };

  const nextTurn = () => {
    setPlayers(prev => {
        const copy = [...prev];
        copy[currentPlayerIndex] = { ...copy[currentPlayerIndex], currentVisit: [] };
        return copy;
    });
    setCurrentPlayerIndex(prev => (prev + 1) % players.length);
  };

  // 3. CORE LOGIIKKA (Korjattu käyttämään prev-tilaa)
  const handleDartThrow = (score: number, multiplier: number) => {
    if (isProcessing || matchResult) return;

    setPlayers(prevPlayers => {
        const currentPlayer = prevPlayers[currentPlayerIndex];
        if (currentPlayer.isBot) return prevPlayers;

        const newPlayers = JSON.parse(JSON.stringify(prevPlayers));
        const p = newPlayers[currentPlayerIndex];

        const totalValue = score * multiplier;
        const newThrow: Throw = { score, multiplier, totalValue };
        p.currentVisit.push(newThrow);
        const newScoreLeft = p.scoreLeft - totalValue;

        // BUST?
        let isBust = false;
        if (settings.doubleOut) {
           if (newScoreLeft < 0 || newScoreLeft === 1 || (newScoreLeft === 0 && multiplier !== 2 && score !== 50)) isBust = true;
        } else {
           if (newScoreLeft < 0) isBust = true;
        }

        if (isBust) {
            setIsProcessing(true);
            setTimeout(() => {
                setPlayers(finalPrev => {
                    const finalPlayers = JSON.parse(JSON.stringify(finalPrev));
                    const fp = finalPlayers[currentPlayerIndex];
                    fp.stats.totalDarts += fp.currentVisit.length;
                    fp.currentVisit = [];
                    // Vuoronvaihto
                    setCurrentPlayerIndex(idx => (idx + 1) % finalPlayers.length);
                    return finalPlayers;
                });
                setIsProcessing(false);
            }, 1000);
            return newPlayers; // Palautetaan tila jossa näkyy "väärä" heitto hetken
        }

        // WIN?
        if (newScoreLeft === 0) {
            p.scoreLeft = 0;
            const visitTotal = p.currentVisit.reduce((a:number,b:Throw)=>a+b.totalValue,0);
            p.stats = updateStats(p, visitTotal, p.currentVisit.length, true);
            handleWin(p, newPlayers);
            return newPlayers;
        }

        // NORM?
        p.scoreLeft = newScoreLeft;

        // 3 DARTS?
        if (p.currentVisit.length === 3) {
            setIsProcessing(true);
            setTimeout(() => {
                setPlayers(finalPrev => {
                    const finalPlayers = JSON.parse(JSON.stringify(finalPrev));
                    const fp = finalPlayers[currentPlayerIndex];
                    const turnTotal = fp.currentVisit.reduce((a:number,b:Throw)=>a+b.totalValue,0);
                    fp.stats = updateStats(fp, turnTotal, 3, false);
                    fp.currentVisit = [];
                    setCurrentPlayerIndex(idx => (idx + 1) % finalPlayers.length);
                    return finalPlayers;
                });
                setIsProcessing(false);
            }, 500);
        }
        
        return newPlayers;
    });
  };

  const handleRTCAttempt = (hit: boolean) => {
    if (isProcessing || matchResult) return;

    setPlayers(prevPlayers => {
        const currentPlayer = prevPlayers[currentPlayerIndex];
        if (currentPlayer.isBot || currentPlayer.currentVisit.length >= 3) return prevPlayers;

        const newPlayers = JSON.parse(JSON.stringify(prevPlayers));
        const p = newPlayers[currentPlayerIndex];

        if (p.rtcFinished) {
            // Skip logic
            setIsProcessing(true);
            setTimeout(() => {
                p.currentVisit = [];
                setPlayers(prev => {
                    const copy = [...prev]; 
                    copy[currentPlayerIndex].currentVisit = []; 
                    return copy; 
                });
                setCurrentPlayerIndex(idx => (idx + 1) % newPlayers.length);
                setIsProcessing(false);
            }, 100);
            return newPlayers;
        }

        const targetKey = p.rtcTarget.toString(); 
        p.stats.rtcDartsThrown += 1;
        if (!p.stats.rtcSectorHistory) p.stats.rtcSectorHistory = {};
        if (!p.stats.rtcSectorHistory[targetKey]) p.stats.rtcSectorHistory[targetKey] = { attempts: 0, hits: 0 };
        p.stats.rtcSectorHistory[targetKey].attempts += 1;

        let turnEndedImmediately = false;
        if (hit) {
            p.stats.rtcTargetsHit += 1;
            p.stats.rtcSectorHistory[targetKey].hits += 1;
            const finishTarget = settings.rtcIncludeBull ? 21 : 20;
            if (p.rtcTarget === finishTarget) {
                p.rtcFinished = true;
                turnEndedImmediately = true; 
            } else {
                p.rtcTarget += 1;
            }
        }

        p.currentVisit.push({ score: hit ? p.rtcTarget : 0, multiplier: 1, totalValue: 0 });

        if (turnEndedImmediately || p.currentVisit.length === 3) {
            setIsProcessing(true);
            setTimeout(() => {
                setPlayers(finalPrev => {
                     const finalPlayers = JSON.parse(JSON.stringify(finalPrev));
                     finalPlayers[currentPlayerIndex].currentVisit = [];
                     
                     // Check win
                     const isLastPlayer = currentPlayerIndex === finalPlayers.length - 1;
                     if (isLastPlayer) {
                         const finishers = finalPlayers.filter((pl: PlayerState) => pl.rtcFinished);
                         if (finishers.length > 0) {
                             finishers.sort((a: PlayerState, b: PlayerState) => a.stats.rtcDartsThrown - b.stats.rtcDartsThrown);
                             setMatchResult({ winner: finishers[0], players: finalPlayers, mode: 'rtc' });
                             setIsProcessing(false);
                             return finalPlayers;
                         }
                     }

                     setCurrentPlayerIndex(idx => (idx + 1) % finalPlayers.length);
                     return finalPlayers;
                });
                setIsProcessing(false);
            }, 500);
        }

        return newPlayers;
    });
  };

  const handleWin = (winner: PlayerState, currentPlayers: PlayerState[]) => {
      winner.legsWon++;
      let matchWon = false;
      let setFinished = false;

      if (settings.matchMode === 'sets') {
        if (winner.legsWon >= settings.legsPerSet) {
            setFinished = true;
            winner.setsWon++;
            currentPlayers.forEach(pl => pl.legsWon = 0);
            if (winner.setsWon >= settings.targetToWin) matchWon = true;
        }
      } else {
          if (winner.legsWon >= settings.targetToWin) matchWon = true;
      }
      
      if (matchWon) {
          setMatchResult({ winner: winner, players: currentPlayers, mode: 'x01' });
          return;
      }
      
      // New Leg
      setIsProcessing(true);
      setTimeout(() => {
          setPlayers(prev => {
              const newP = JSON.parse(JSON.stringify(prev));
              const nextStarter = setFinished 
                ? (setStarterIndex + 1) % newP.length
                : (legStarterIndex + 1) % newP.length;
              
              if (setFinished) { setSetStarterIndex(nextStarter); setLegStarterIndex(nextStarter); }
              else { setLegStarterIndex(nextStarter); }

              newP.forEach((pl: PlayerState) => { pl.scoreLeft = settings.startScore; pl.currentVisit = []; });
              setCurrentPlayerIndex(nextStarter);
              return newP;
          });
          setIsProcessing(false);
      }, 2000);
  };

  const resetGame = () => {
      setMatchResult(null);
      setIsProcessing(false);
      setHistoryStack([]);
  };

  return {
    players,
    setPlayers,
    currentPlayer: players[currentPlayerIndex] || undefined,
    handleDartThrow,
    handleRTCAttempt,
    currentPlayerIndex,
    matchResult,
    isProcessing,
    resetGame,
    undoLastThrow,
    canUndo: historyStack.length > 0 && !isProcessing
  };
};