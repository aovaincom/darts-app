import { useState, useEffect } from 'react';
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

  // 2. DARTBOT TRIGGER
  useEffect(() => {
    if (players.length === 0 || matchResult) return;

    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer && currentPlayer.isBot && !isProcessing) {
        const delay = setTimeout(() => {
            if (settings.gameMode === 'x01') executeBotTurnX01(currentPlayer);
            else executeBotTurnRTC(currentPlayer);
        }, 1200);
        return () => clearTimeout(delay);
    }
  }, [currentPlayerIndex, players, isProcessing, matchResult]);

  // --- UNDO / HISTORY ---
  const saveStateToHistory = () => {
      setHistoryStack(prev => [...prev, { players: JSON.parse(JSON.stringify(players)), currentPlayerIndex, legStarterIndex, setStarterIndex }]);
  };

  const undoLastThrow = () => {
      if (historyStack.length === 0 || isProcessing || matchResult) return;
      const previousState = historyStack[historyStack.length - 1];
      setPlayers(previousState.players);
      setCurrentPlayerIndex(previousState.currentPlayerIndex);
      setLegStarterIndex(previousState.legStarterIndex);
      setSetStarterIndex(previousState.setStarterIndex);
      setHistoryStack(prev => prev.slice(0, -1));
  };

  // --- RESET GAME ---
  const resetGame = () => {
    setMatchResult(null);
    setIsProcessing(false);
    setHistoryStack([]);
    // State resetoidaan useEffectin kautta kun valikkoon palataan
  };

  // --- BOT LOGIC X01 ---
  const executeBotTurnX01 = (bot: PlayerState) => {
      const throws = getBotTurn(bot.scoreLeft, bot.botSkill);
      let tempScore = bot.scoreLeft;
      let bust = false;
      const visitThrows: Throw[] = [];

      for (const t of throws) {
          const total = t.score * t.multiplier;
          const nextScore = tempScore - total;
          
          let isThrowBust = false;
          if (settings.doubleOut) {
             if (nextScore < 0 || nextScore === 1 || (nextScore === 0 && t.multiplier !== 2 && t.score !== 50)) isThrowBust = true;
          } else {
             if (nextScore < 0) isThrowBust = true;
          }

          if (isThrowBust) {
              bust = true;
              visitThrows.push({ ...t, totalValue: total });
              break; 
          }
          
          tempScore = nextScore;
          visitThrows.push({ ...t, totalValue: total });
          if (nextScore === 0) break; 
      }

      processBotVisitResult(visitThrows, bust);
  };

  const processBotVisitResult = (visit: Throw[], isBust: boolean) => {
      saveStateToHistory();
      setIsProcessing(true);

      const updatedPlayers = [...players];
      const p = updatedPlayers[currentPlayerIndex];
      const visitTotal = visit.reduce((a, b) => a + b.totalValue, 0);
      
      p.stats = updateStats(p, isBust ? 0 : visitTotal, visit.length, (!isBust && p.scoreLeft - visitTotal === 0));

      if (!isBust) {
          p.scoreLeft -= visitTotal;
      }

      p.currentVisit = visit;
      setPlayers(updatedPlayers);

      if (p.scoreLeft === 0 && !isBust) {
          handleWin(p, updatedPlayers);
          return;
      }

      setTimeout(() => {
          const finalPlayers = [...updatedPlayers];
          finalPlayers[currentPlayerIndex].currentVisit = [];
          setPlayers(finalPlayers);
          nextTurn();
          setIsProcessing(false);
      }, 1500);
  };

  // --- BOT LOGIC RTC ---
  const executeBotTurnRTC = (bot: PlayerState) => {
      if (bot.rtcFinished) {
          nextTurn();
          return;
      }

      let hits = 0;
      let finished = false;
      const finishTarget = settings.rtcIncludeBull ? 21 : 20;

      for (let i=0; i<3; i++) {
          if (bot.rtcTarget > finishTarget) break; 
          
          const roll = Math.random() * 100;
          const hitChance = bot.botSkill + 10; 
          
          if (roll < hitChance) {
              hits++;
              if (bot.rtcTarget === finishTarget) {
                  finished = true;
                  bot.rtcFinished = true;
                  break; 
              }
              bot.rtcTarget++;
          }
      }
      
      const updatedPlayers = [...players];
      const p = updatedPlayers[currentPlayerIndex];
      p.stats.rtcDartsThrown += 3; 
      p.stats.rtcTargetsHit += hits;
      if (finished) p.rtcFinished = true;
      p.currentVisit = Array(3).fill({score: 0, multiplier: 1, totalValue: 0});
      
      setPlayers(updatedPlayers);
      setIsProcessing(true);

      setTimeout(() => {
         const finalPlayers = [...updatedPlayers];
         finalPlayers[currentPlayerIndex].currentVisit = [];
         setPlayers(finalPlayers);
         checkRTCEndCondition(finalPlayers);
      }, 1000);
  };

  // --- HUMAN INPUTS ---
  const handleDartThrow = (score: number, multiplier: number) => {
    const currentPlayer = players[currentPlayerIndex];
    if (players.length === 0 || isProcessing || matchResult || players[currentPlayerIndex].isBot) return;
    if (settings.gameMode !== 'x01') return; 

    saveStateToHistory();
    setIsProcessing(true);

    const totalValue = score * multiplier;
    const newThrow: Throw = { score, multiplier, totalValue };
    const updatedVisit = [...currentPlayer.currentVisit, newThrow];
    const newScoreLeft = currentPlayer.scoreLeft - totalValue;

    let isBust = false;
    if (settings.doubleOut) {
       if (newScoreLeft < 0 || newScoreLeft === 1 || (newScoreLeft === 0 && multiplier !== 2 && score !== 50)) isBust = true;
    } else {
       if (newScoreLeft < 0) isBust = true;
    }

    if (isBust) {
        const updatedPlayers = [...players];
        updatedPlayers[currentPlayerIndex].currentVisit = updatedVisit;
        setPlayers(updatedPlayers);

        setTimeout(() => {
            const finalPlayers = [...players];
            finalPlayers[currentPlayerIndex].currentVisit = [];
            const p = finalPlayers[currentPlayerIndex];
            p.stats.totalDarts += updatedVisit.length; 
            
            setPlayers(finalPlayers);
            nextTurn(); 
            setIsProcessing(false);
        }, 1000);
        return;
    }

    if (newScoreLeft === 0) {
        const updatedPlayers = [...players];
        const p = updatedPlayers[currentPlayerIndex];
        
        p.currentVisit = updatedVisit;
        p.scoreLeft = 0;
        p.stats = updateStats(p, updatedVisit.reduce((a,b)=>a+b.totalValue,0), updatedVisit.length, true);

        setPlayers(updatedPlayers);
        handleWin(p, updatedPlayers);
        return;
    }

    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex].currentVisit = updatedVisit;
    updatedPlayers[currentPlayerIndex].scoreLeft = newScoreLeft;
    setPlayers(updatedPlayers);

    if (updatedVisit.length === 3) {
      setTimeout(() => {
        const finalPlayers = [...players];
        const p = finalPlayers[currentPlayerIndex];
        const turnTotal = updatedVisit.reduce((acc, t) => acc + t.totalValue, 0);
        
        p.stats = updateStats(p, turnTotal, 3, false);
        p.currentVisit = [];
        setPlayers(finalPlayers);
        
        nextTurn();
        setIsProcessing(false);
      }, 500);
    } else {
        setIsProcessing(false);
    }
  };

  const handleRTCAttempt = (hit: boolean) => {
    const currentPlayer = players[currentPlayerIndex];
    if (players.length === 0 || matchResult || isProcessing || currentPlayer.isBot || currentPlayer.currentVisit.length >= 3) return;
    
    saveStateToHistory();

    if (currentPlayer.rtcFinished) {
        nextTurn();
        return;
    }

    const updatedPlayers = [...players];
    const p = updatedPlayers[currentPlayerIndex];
    const target = p.rtcTarget;
    const targetKey = target.toString(); 

    p.stats.rtcDartsThrown += 1;
    if (!p.stats.rtcSectorHistory) p.stats.rtcSectorHistory = {};
    if (!p.stats.rtcSectorHistory[targetKey]) p.stats.rtcSectorHistory[targetKey] = { attempts: 0, hits: 0 };
    p.stats.rtcSectorHistory[targetKey].attempts += 1;

    let turnEndedImmediately = false;
    if (hit) {
        p.stats.rtcTargetsHit += 1;
        p.stats.rtcSectorHistory[targetKey].hits += 1;
        const finishTarget = settings.rtcIncludeBull ? 21 : 20;
        if (target === finishTarget) {
            p.rtcFinished = true;
            turnEndedImmediately = true; 
        } else {
            p.rtcTarget += 1;
        }
    }

    const dummyThrow: Throw = { score: hit ? target : 0, multiplier: 1, totalValue: 0 };
    const newVisit = [...p.currentVisit, dummyThrow];
    updatedPlayers[currentPlayerIndex].currentVisit = newVisit;
    setPlayers(updatedPlayers);

    if (turnEndedImmediately || newVisit.length === 3) {
        setIsProcessing(true); 
        setTimeout(() => {
            const finalPlayers = [...players];
            finalPlayers[currentPlayerIndex].currentVisit = [];
            setPlayers(finalPlayers);
            checkRTCEndCondition(finalPlayers);
        }, 500);
    }
  };

  // --- HELPERS ---
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
          setIsProcessing(false);
          return;
      }
      
      setTimeout(() => {
          const nextStarter = setFinished 
            ? (setStarterIndex + 1) % players.length
            : (legStarterIndex + 1) % players.length;
            
          if (setFinished) { setSetStarterIndex(nextStarter); setLegStarterIndex(nextStarter); }
          else { setLegStarterIndex(nextStarter); }

          currentPlayers.forEach(pl => { pl.scoreLeft = settings.startScore; pl.currentVisit = []; });
          setPlayers(currentPlayers);
          setCurrentPlayerIndex(nextStarter);
          setIsProcessing(false);
      }, 2000);
  };

  const updateStats = (player: PlayerState, visitTotal: number, dartsThrown: number, isCheckout: boolean) => {
    const s = { ...player.stats };
    if (settings.gameMode === 'x01') {
        s.totalScore += visitTotal;
        s.totalDarts += dartsThrown;
        s.average = parseFloat(((s.totalScore / s.totalDarts) * 3).toFixed(2));
        if (visitTotal === 180) s.scores180++;
        else if (visitTotal >= 140) s.scores140plus++;
        else if (visitTotal >= 120) s.scores120plus++;
        else if (visitTotal >= 100) s.scores100plus++;
        else if (visitTotal >= 80) s.scores80plus++;
        else if (visitTotal >= 60) s.scores60plus++;
        if (isCheckout) {
          if (visitTotal > s.highestCheckout) s.highestCheckout = visitTotal;
          if (visitTotal >= 100) s.tonPlusFinishes++;
        }
    }
    return s;
  };

  const nextTurn = () => {
    if (players.length === 0) return;
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex].currentVisit = [];
    setPlayers(updatedPlayers);
    setCurrentPlayerIndex((prev) => (prev + 1) % players.length);
  };

  const checkRTCEndCondition = (currentPlayers: PlayerState[]) => {
      const isLastPlayer = currentPlayerIndex === currentPlayers.length - 1;
      if (isLastPlayer) {
          const someoneFinished = currentPlayers.some(p => p.rtcFinished);
          if (someoneFinished) {
              const finishers = currentPlayers.filter(p => p.rtcFinished);
              finishers.sort((a, b) => a.stats.rtcDartsThrown - b.stats.rtcDartsThrown);
              setMatchResult({ winner: finishers[0], players: currentPlayers, mode: 'rtc' });
              setIsProcessing(false);
              return;
          }
      }
      nextTurn();
      setIsProcessing(false);
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