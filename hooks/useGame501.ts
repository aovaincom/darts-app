import { useState, useEffect } from 'react';
import { SavedProfile } from './useProfiles';

type Throw = {
  score: number;
  multiplier: number;
  totalValue: number;
};

export type PlayerStats = {
  // X01 Stats
  average: number;
  totalScore: number;
  totalDarts: number;
  highestCheckout: number;
  // Bins
  scores60plus: number;
  scores80plus: number;
  scores100plus: number;
  scores120plus: number;
  scores140plus: number;
  scores180: number;
  tonPlusFinishes: number; // 100+ checkouts

  // RTC Stats
  rtcTargetsHit: number; 
  rtcDartsThrown: number;
  rtcSectorHistory: Record<string, { attempts: number; hits: number }>; 
};

export type PlayerState = {
  id: number;
  profileId?: string;
  name: string;
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

// Tyyppi historian tallentamiseen UNDO-toimintoa varten
type GameHistoryState = {
    players: PlayerState[];
    currentPlayerIndex: number;
    legStarterIndex: number;
    setStarterIndex: number;
};

export const useGameLogic = (settings: GameSettings, selectedProfiles: SavedProfile[]) => {
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  
  const [legStarterIndex, setLegStarterIndex] = useState(0);
  const [setStarterIndex, setSetStarterIndex] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult>(null);

  // UNDO HISTORY STACK
  const [historyStack, setHistoryStack] = useState<GameHistoryState[]>([]);

  const profilesHash = selectedProfiles.map(p => p.id).join(',');

  useEffect(() => {
    if (selectedProfiles.length === 0) return;

    const newPlayers = selectedProfiles.map((profile, index) => ({
      id: index,
      profileId: profile.id,
      name: profile.name,
      scoreLeft: settings.startScore,
      rtcTarget: 1, 
      rtcFinished: false,
      setsWon: 0,
      legsWon: 0,
      history: [],
      currentVisit: [],
      stats: {
        average: 0,
        totalScore: 0,
        totalDarts: 0,
        highestCheckout: 0,
        scores60plus: 0,
        scores80plus: 0,
        scores100plus: 0,
        scores120plus: 0,
        scores140plus: 0,
        scores180: 0,
        tonPlusFinishes: 0,
        rtcTargetsHit: 0,
        rtcDartsThrown: 0,
        rtcSectorHistory: {}
      }
    }));
    setPlayers(newPlayers);
    
    setCurrentPlayerIndex(0); 
    setLegStarterIndex(0);
    setSetStarterIndex(0);
    setMatchResult(null);
    setIsProcessing(false);
    setHistoryStack([]); // Clear history on new game
  }, [profilesHash, settings.startScore, settings.gameMode, settings.rtcIncludeBull]);

  const resetGame = () => {
    setMatchResult(null);
    setIsProcessing(false);
    setHistoryStack([]);
  };

  // Helper to save state before modifying it
  const saveStateToHistory = () => {
      setHistoryStack(prev => [
          ...prev, 
          {
              players: JSON.parse(JSON.stringify(players)), // Deep copy
              currentPlayerIndex,
              legStarterIndex,
              setStarterIndex
          }
      ]);
  };

  const undoLastThrow = () => {
      if (historyStack.length === 0 || isProcessing || matchResult) return;
      
      const previousState = historyStack[historyStack.length - 1];
      
      setPlayers(previousState.players);
      setCurrentPlayerIndex(previousState.currentPlayerIndex);
      setLegStarterIndex(previousState.legStarterIndex);
      setSetStarterIndex(previousState.setStarterIndex);
      
      // Remove used state
      setHistoryStack(prev => prev.slice(0, -1));
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

  // --- RTC HANDLER ---
  const handleRTCAttempt = (hit: boolean) => {
    const currentPlayer = players[currentPlayerIndex];
    if (players.length === 0 || matchResult || isProcessing || currentPlayer.currentVisit.length >= 3) return;
    
    // Undo checkpoint
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
    if (!p.stats.rtcSectorHistory[targetKey]) {
        p.stats.rtcSectorHistory[targetKey] = { attempts: 0, hits: 0 };
    }
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

  const checkRTCEndCondition = (currentPlayers: PlayerState[]) => {
      const isLastPlayer = currentPlayerIndex === currentPlayers.length - 1;
      
      if (isLastPlayer) {
          const someoneFinished = currentPlayers.some(p => p.rtcFinished);
          if (someoneFinished) {
              const finishers = currentPlayers.filter(p => p.rtcFinished);
              finishers.sort((a, b) => a.stats.rtcDartsThrown - b.stats.rtcDartsThrown);
              setMatchResult({
                  winner: finishers[0],
                  players: currentPlayers,
                  mode: 'rtc'
              });
              setIsProcessing(false);
              return;
          }
      }
      nextTurn();
      setIsProcessing(false);
  };

  // --- X01 HANDLER ---
  const handleDartThrow = (score: number, multiplier: number) => {
    if (players.length === 0 || isProcessing || matchResult) return;
    if (settings.gameMode !== 'x01') return; 

    // Undo checkpoint
    saveStateToHistory();

    setIsProcessing(true);

    const totalValue = score * multiplier;
    const currentPlayer = players[currentPlayerIndex];
    const newThrow: Throw = { score, multiplier, totalValue };
    const updatedVisit = [...currentPlayer.currentVisit, newThrow];

    const visitTotal = updatedVisit.reduce((acc, t) => acc + t.totalValue, 0);
    const newScoreLeft = currentPlayer.scoreLeft - totalValue;

    let isBust = false;
    if (settings.doubleOut) {
       if (newScoreLeft < 0 || newScoreLeft === 1) isBust = true;
       if (newScoreLeft === 0 && multiplier !== 2 && score !== 50) isBust = true;
    } else {
       if (newScoreLeft < 0) isBust = true;
    }

    if (isBust) {
      setTimeout(() => {
        nextTurn();
        setIsProcessing(false);
      }, 1000);
      return;
    }

    if (newScoreLeft === 0) {
      const updatedPlayers = [...players];
      const winner = updatedPlayers[currentPlayerIndex];

      winner.stats = updateStats(winner, visitTotal, updatedVisit.length, true);
      winner.legsWon += 1;

      let matchWon = false;
      let setFinished = false;
      
      if (settings.matchMode === 'sets') {
        if (winner.legsWon >= settings.legsPerSet) {
          setFinished = true;
          winner.setsWon += 1;
          updatedPlayers.forEach(p => p.legsWon = 0); 
          if (winner.setsWon >= settings.targetToWin) matchWon = true;
        }
      } else {
        if (winner.legsWon >= settings.targetToWin) matchWon = true;
      }

      if (matchWon) {
        setPlayers(updatedPlayers);
        setMatchResult({
            winner: winner,
            players: updatedPlayers,
            mode: 'x01'
        });
        setIsProcessing(false);
        return;
      }

      updatedPlayers.forEach(p => {
        p.scoreLeft = settings.startScore;
        p.currentVisit = [];
      });

      let nextStarter = 0;
      if (setFinished) {
         const nextSetStarter = (setStarterIndex + 1) % players.length;
         setSetStarterIndex(nextSetStarter);
         setLegStarterIndex(nextSetStarter); 
         nextStarter = nextSetStarter;
      } else {
         const nextLegStarter = (legStarterIndex + 1) % players.length;
         setLegStarterIndex(nextLegStarter);
         nextStarter = nextLegStarter;
      }

      setPlayers(updatedPlayers);
      setCurrentPlayerIndex(nextStarter);
      // History stack clears if we change legs/sets? 
      // Decision: Let's keep history only for within a leg to avoid complex state restoration across legs.
      // But for simplicity in this codebase, we keep the stack. 
      // Note: restoring a leg start state might be tricky if not all variables are tracked.
      // Current implementation saves full player state so it should work fine.
      
      setIsProcessing(false);
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
        
        setCurrentPlayerIndex((prev) => (prev + 1) % players.length);
        setIsProcessing(false);
      }, 800);
    } else {
        setIsProcessing(false);
    }
  };

  const nextTurn = () => {
    if (players.length === 0) return;
    const updatedPlayers = [...players];
    const p = updatedPlayers[currentPlayerIndex];
    if (settings.gameMode === 'x01') {
        const visitScore = p.currentVisit.reduce((acc, t) => acc + t.totalValue, 0);
        p.scoreLeft += visitScore; 
    }
    p.currentVisit = [];
    setPlayers(updatedPlayers);
    setCurrentPlayerIndex((prev) => (prev + 1) % players.length);
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
    undoLastThrow, // Export undo
    canUndo: historyStack.length > 0 && !isProcessing
  };
};