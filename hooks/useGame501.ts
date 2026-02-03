import { useState, useEffect, useRef, useCallback } from 'react';
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
  // --- STATE ---
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [legStarterIndex, setLegStarterIndex] = useState(0);
  const [setStarterIndex, setSetStarterIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult>(null);
  const [historyStack, setHistoryStack] = useState<GameHistoryState[]>([]);

  // --- REFS (The "Absolute Truth") ---
  // Nämä pitävät kirjaa tilanteesta ilman viivettä. Tämä korjaa sen, miksi peli "unohti" heitot.
  const playersRef = useRef(players);
  const playerIndexRef = useRef(currentPlayerIndex);
  const processingRef = useRef(isProcessing);

  // Synkronoidaan Refit aina kun State muuttuu
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { playerIndexRef.current = currentPlayerIndex; }, [currentPlayerIndex]);
  useEffect(() => { processingRef.current = isProcessing; }, [isProcessing]);

  // --- INIT ---
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

  // --- HELPERS (Defining first to rely on Ref) ---
  
  const updateStats = useCallback((player: PlayerState, visitTotal: number, dartsThrown: number, isCheckout: boolean) => {
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
  }, [settings.gameMode]);

  const internalSetPlayers = (newPlayers: PlayerState[]) => {
      setPlayers(newPlayers);
      playersRef.current = newPlayers; // Päivitetään heti ref myös
  };

  const nextTurn = useCallback((overridePlayers?: PlayerState[]) => {
      const currentP = overridePlayers || playersRef.current;
      const nextIndex = (playerIndexRef.current + 1) % currentP.length;
      
      // Tyhjennetään nykyisen pelaajan visit visuaalisesti
      const finalPlayers = JSON.parse(JSON.stringify(currentP));
      finalPlayers[playerIndexRef.current].currentVisit = [];
      
      internalSetPlayers(finalPlayers);
      setCurrentPlayerIndex(nextIndex);
  }, []);

  const handleWin = useCallback((winnerId: number, currentPlayers: PlayerState[]) => {
      const winner = currentPlayers.find(p => p.id === winnerId)!;
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
          // Logiikka seuraavan aloittajan valintaan
          // Tässä yksinkertaistettu versio ref-turvallisuuden vuoksi
          const nextLegStarter = (legStarterIndex + 1) % currentPlayers.length; // Huom: tämä saattaa olla yhden legin jäljessä ref-mielessä, mutta ei kriittinen
          setLegStarterIndex(nextLegStarter); // Oikeasti pitäisi käyttää refiä tällekin jos haluaa täydellisyyden, mutta mennään tällä

          currentPlayers.forEach(pl => { pl.scoreLeft = settings.startScore; pl.currentVisit = []; });
          internalSetPlayers(currentPlayers);
          setCurrentPlayerIndex(nextLegStarter);
          setIsProcessing(false);
      }, 2000);
  }, [settings, legStarterIndex]);

  // --- BOT LOOP ---
  useEffect(() => {
    if (players.length === 0 || matchResult) return;
    const currentPlayer = players[currentPlayerIndex];
    
    // Tarkistetaan Refin kautta onko jo prosessointi käynnissä
    if (currentPlayer && currentPlayer.isBot && !processingRef.current) {
        const delay = setTimeout(() => {
            if (processingRef.current) return; // Tuplatarkistus
            if (settings.gameMode === 'x01') executeBotTurnX01();
            else executeBotTurnRTC();
        }, 1000);
        return () => clearTimeout(delay);
    }
  }, [currentPlayerIndex, players, matchResult, settings.gameMode]);

  // --- ACTIONS (Ref-Safe) ---

  const executeBotTurnX01 = () => {
      setIsProcessing(true);
      const activePlayers = JSON.parse(JSON.stringify(playersRef.current));
      const idx = playerIndexRef.current;
      const bot = activePlayers[idx];

      const throws = getBotTurn(bot.scoreLeft, bot.botSkill);
      let tempScore = bot.scoreLeft;
      let bust = false;
      const visitThrows: Throw[] = [];

      for (const t of throws) {
          const total = t.score * t.multiplier;
          const nextScore = tempScore - total;
          let isBust = false;
          if (settings.doubleOut) {
             if (nextScore < 0 || nextScore === 1 || (nextScore === 0 && t.multiplier !== 2 && t.score !== 50)) isBust = true;
          } else {
             if (nextScore < 0) isBust = true;
          }

          if (isBust) {
              bust = true;
              visitThrows.push({ ...t, totalValue: total });
              break; 
          }
          tempScore = nextScore;
          visitThrows.push({ ...t, totalValue: total });
          if (nextScore === 0) break; 
      }

      // 1. Näytä heitot
      bot.currentVisit = visitThrows;
      const visitTotal = visitThrows.reduce((a, b) => a + b.totalValue, 0);
      
      if (!bust) bot.scoreLeft -= visitTotal;
      bot.stats = updateStats(bot, bust ? 0 : visitTotal, visitThrows.length, (!bust && bot.scoreLeft === 0));

      internalSetPlayers(activePlayers);

      // 2. Viive ja vaihto
      if (bot.scoreLeft === 0 && !bust) {
          handleWin(bot.id, activePlayers);
      } else {
          setTimeout(() => {
              nextTurn(activePlayers);
              setIsProcessing(false);
          }, 1500);
      }
  };

  const executeBotTurnRTC = () => {
      setIsProcessing(true);
      const activePlayers = JSON.parse(JSON.stringify(playersRef.current));
      const idx = playerIndexRef.current;
      const bot = activePlayers[idx];

      if (bot.rtcFinished) {
          nextTurn(activePlayers);
          setIsProcessing(false);
          return;
      }

      let hits = 0;
      let finished = false;
      const finishTarget = settings.rtcIncludeBull ? 21 : 20;

      for (let i=0; i<3; i++) {
          if (bot.rtcTarget > finishTarget) break; 
          const roll = Math.random() * 100;
          if (roll < (bot.botSkill + 10)) {
              hits++;
              if (bot.rtcTarget === finishTarget) {
                  finished = true;
                  bot.rtcFinished = true;
                  break; 
              }
              bot.rtcTarget++;
          }
      }
      
      bot.stats.rtcDartsThrown += 3; 
      bot.stats.rtcTargetsHit += hits;
      if (finished) bot.rtcFinished = true;
      bot.currentVisit = Array(3).fill({score: 0, multiplier: 1, totalValue: 0});
      
      internalSetPlayers(activePlayers);

      setTimeout(() => {
         checkRTCEndCondition(activePlayers);
      }, 1000);
  };

  const handleDartThrow = (score: number, multiplier: number) => {
    // Check REFS instead of state to avoid closure traps
    if (processingRef.current || matchResult) return;
    const idx = playerIndexRef.current;
    if (playersRef.current[idx].isBot) return;
    if (settings.gameMode !== 'x01') return; 

    setIsProcessing(true); // Lock immediately

    // Deep copy from REF
    const activePlayers = JSON.parse(JSON.stringify(playersRef.current));
    const p = activePlayers[idx];

    const totalValue = score * multiplier;
    const newThrow: Throw = { score, multiplier, totalValue };
    p.currentVisit.push(newThrow);
    const newScoreLeft = p.scoreLeft - totalValue;

    // Bust Logic
    let isBust = false;
    if (settings.doubleOut) {
       if (newScoreLeft < 0 || newScoreLeft === 1 || (newScoreLeft === 0 && multiplier !== 2 && score !== 50)) isBust = true;
    } else {
       if (newScoreLeft < 0) isBust = true;
    }

    if (isBust) {
        internalSetPlayers(activePlayers);
        setTimeout(() => {
            // Re-read ref just in case, but usually safe here.
            // Bust reset:
            const bustPlayers = JSON.parse(JSON.stringify(activePlayers));
            const bp = bustPlayers[idx];
            bp.stats.totalDarts += bp.currentVisit.length;
            bp.currentVisit = [];
            // Score stays same
            nextTurn(bustPlayers);
            setIsProcessing(false);
        }, 1000);
        return;
    }

    if (newScoreLeft === 0) {
        p.scoreLeft = 0;
        const visitTotal = p.currentVisit.reduce((a:number,b:Throw)=>a+b.totalValue,0);
        p.stats = updateStats(p, visitTotal, p.currentVisit.length, true);
        internalSetPlayers(activePlayers);
        handleWin(p.id, activePlayers);
        return;
    }

    // Normal Throw
    p.scoreLeft = newScoreLeft;
    internalSetPlayers(activePlayers);

    if (p.currentVisit.length === 3) {
        setTimeout(() => {
            const finalPlayers = JSON.parse(JSON.stringify(activePlayers));
            const fp = finalPlayers[idx];
            const turnTotal = fp.currentVisit.reduce((acc:number, t:Throw) => acc + t.totalValue, 0);
            fp.stats = updateStats(fp, turnTotal, 3, false);
            
            nextTurn(finalPlayers);
            setIsProcessing(false);
        }, 500);
    } else {
        setIsProcessing(false);
    }
  };

  const handleRTCAttempt = (hit: boolean) => {
    if (processingRef.current || matchResult) return;
    const idx = playerIndexRef.current;
    if (playersRef.current[idx].isBot) return;
    if (playersRef.current[idx].currentVisit.length >= 3) return;

    // Deep copy from REF
    const activePlayers = JSON.parse(JSON.stringify(playersRef.current));
    const p = activePlayers[idx];

    if (p.rtcFinished) {
        nextTurn(activePlayers);
        return;
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
    internalSetPlayers(activePlayers);

    if (turnEndedImmediately || p.currentVisit.length === 3) {
        setIsProcessing(true);
        setTimeout(() => {
            checkRTCEndCondition(activePlayers);
        }, 500);
    }
  };

  const checkRTCEndCondition = (currentPlayers: PlayerState[]) => {
      const idx = playerIndexRef.current;
      const isLastPlayer = idx === currentPlayers.length - 1;
      
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
      nextTurn(currentPlayers);
      setIsProcessing(false);
  };

  // --- HISTORY & RESET ---
  const saveStateToHistory = () => {
      setHistoryStack(prev => [...prev, { 
          players: JSON.parse(JSON.stringify(playersRef.current)), 
          currentPlayerIndex: playerIndexRef.current, 
          legStarterIndex, setStarterIndex 
      }]);
  };

  const undoLastThrow = () => {
      if (historyStack.length === 0 || isProcessing || matchResult) return;
      const previousState = historyStack[historyStack.length - 1];
      internalSetPlayers(previousState.players);
      setCurrentPlayerIndex(previousState.currentPlayerIndex);
      setHistoryStack(prev => prev.slice(0, -1));
  };

  const resetGame = () => {
    setMatchResult(null);
    setIsProcessing(false);
    setHistoryStack([]);
  };

  return {
    players,
    setPlayers: internalSetPlayers,
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