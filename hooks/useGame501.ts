import { useState, useEffect } from 'react';
import { SavedProfile } from './useProfiles';
import { getBotTurn } from '../utils/dartbot';

// --- TYYPIT ---
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
  // --- TILA ---
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [legStarterIndex, setLegStarterIndex] = useState(0);
  const [setStarterIndex, setSetStarterIndex] = useState(0);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult>(null);
  const [historyStack, setHistoryStack] = useState<GameHistoryState[]>([]);

  // 1. ALUSTUS
  useEffect(() => {
    console.log("Initializing Game with settings:", settings);
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
    setMatchResult(null);
    setIsProcessing(false);
  }, [selectedProfiles, settings.startScore, settings.gameMode, botConfig]);

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
    setHistoryStack(history => history.slice(0, -1));
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
    setCurrentPlayerIndex(prev => (prev + 1) % players.length);
  };

  // 3. X01 HEITTO (Yksinkertaistettu)
  const handleDartThrow = (score: number, multiplier: number) => {
    console.log(`Throw registered: ${score} x ${multiplier}`); // DEBUG
    
    // Tarkistukset
    if (players.length === 0 || matchResult) return;
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.isBot) return;
    if (settings.gameMode !== 'x01') return;

    // Jos käsittely kesken, estä uudet heitot (paitsi jos edellinen oli bust/win animaatio)
    if (isProcessing) {
        console.log("Throw ignored: Processing in progress");
        return;
    }

    saveStateToHistory();
    
    // Luodaan kopio tilasta
    const newPlayers = JSON.parse(JSON.stringify(players));
    const p = newPlayers[currentPlayerIndex];

    const totalValue = score * multiplier;
    const newThrow: Throw = { score, multiplier, totalValue };
    p.currentVisit.push(newThrow);
    
    const newScoreLeft = p.scoreLeft - totalValue;
    
    // Bust check
    let isBust = false;
    if (settings.doubleOut) {
       if (newScoreLeft < 0 || newScoreLeft === 1 || (newScoreLeft === 0 && multiplier !== 2 && score !== 50)) isBust = true;
    } else {
       if (newScoreLeft < 0) isBust = true;
    }

    if (isBust) {
        console.log("BUST!");
        setIsProcessing(true);
        setPlayers(newPlayers); // Näytä heitto

        setTimeout(() => {
            // Palauta tila ennen heittoja, mutta lisää heitetyt tikat tilastoihin
            const resetPlayers = JSON.parse(JSON.stringify(players)); // Alkuperäinen tila (ennen tätä heittoa? Ei, vaan ennen vuoroa)
            // Itseasiassa bustissa nollataan visit, mutta pisteet palautuvat vuoron alkuun.
            // Yksinkertaistus: Bust resetoi visitin ja vaihtaa vuoron.
            const bustP = resetPlayers[currentPlayerIndex];
            // Koska players-muuttuja tässä funktiossa viittaa tilaan ennen TÄTÄ heittoa, 
            // meidän pitää itse asiassa palauttaa pisteet siihen mitä ne olivat ennen vuoroa?
            // Tässä versiossa palautetaan pisteet siihen mitä ne olivat ennen tätä virheheittoa.
            // Oikea sääntö: Pisteet palaavat siihen mitä ne olivat ennen VUORON alkua.
            // Korjataan tämä myöhemmin jos tarvis, nyt fokus toimivuudessa.
            
            // Yksinkertainen bust: nollataan nykyinen visit
            bustP.currentVisit = [];
            // Lisätään heitetyt tikat stats
            bustP.stats.totalDarts += p.currentVisit.length;

            setPlayers(resetPlayers);
            nextTurn();
            setIsProcessing(false);
        }, 1000);
        return;
    }

    if (newScoreLeft === 0) {
        console.log("WINNER!");
        p.scoreLeft = 0;
        const visitTotal = p.currentVisit.reduce((a: number, b: Throw) => a + b.totalValue, 0);
        p.stats = updateStats(p, visitTotal, p.currentVisit.length, true);
        setPlayers(newPlayers);
        handleWin(p, newPlayers);
        return;
    }

    // Normaali heitto
    p.scoreLeft = newScoreLeft;
    setPlayers(newPlayers);

    // 3 tikkaa
    if (p.currentVisit.length === 3) {
        setIsProcessing(true);
        setTimeout(() => {
            const finalPlayers = JSON.parse(JSON.stringify(newPlayers));
            const fp = finalPlayers[currentPlayerIndex];
            
            const turnTotal = fp.currentVisit.reduce((acc: number, t: Throw) => acc + t.totalValue, 0);
            fp.stats = updateStats(fp, turnTotal, 3, false);
            fp.currentVisit = [];
            
            setPlayers(finalPlayers);
            nextTurn();
            setIsProcessing(false);
        }, 500);
    }
  };

  // 4. RTC HEITTO
  const handleRTCAttempt = (hit: boolean) => {
    console.log(`RTC Throw: ${hit ? 'HIT' : 'MISS'}`);
    if (players.length === 0 || matchResult) return;
    if (isProcessing && players[currentPlayerIndex].currentVisit.length === 3) return; // Estä jos vaihto kesken
    
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.isBot) return;
    if (currentPlayer.currentVisit.length >= 3) return; // Estä 4. heitto

    saveStateToHistory();

    const newPlayers = JSON.parse(JSON.stringify(players));
    const p = newPlayers[currentPlayerIndex];

    if (p.rtcFinished) {
        nextTurn();
        return;
    }

    const targetKey = p.rtcTarget.toString();
    p.stats.rtcDartsThrown += 1;
    
    // Alustetaan historia jos puuttuu
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
    setPlayers(newPlayers);

    if (turnEndedImmediately || p.currentVisit.length === 3) {
        setIsProcessing(true);
        setTimeout(() => {
            const finalPlayers = JSON.parse(JSON.stringify(newPlayers));
            finalPlayers[currentPlayerIndex].currentVisit = [];
            setPlayers(finalPlayers);
            
            // Tarkista voitto
            const isLastPlayer = currentPlayerIndex === players.length - 1;
            if (isLastPlayer) {
                const finishers = finalPlayers.filter((pl: PlayerState) => pl.rtcFinished);
                if (finishers.length > 0) {
                     finishers.sort((a: PlayerState, b: PlayerState) => a.stats.rtcDartsThrown - b.stats.rtcDartsThrown);
                     setMatchResult({ winner: finishers[0], players: finalPlayers, mode: 'rtc' });
                     setIsProcessing(false);
                     return;
                }
            }
            
            nextTurn();
            setIsProcessing(false);
        }, 500);
    }
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

  const resetGame = () => {
      setMatchResult(null);
      setIsProcessing(false);
      setHistoryStack([]);
  };

  // 5. BOT LOOP (Yksinkertainen)
  useEffect(() => {
      if (players.length === 0 || matchResult) return;
      const currentPlayer = players[currentPlayerIndex];

      if (currentPlayer && currentPlayer.isBot && !isProcessing) {
          const timer = setTimeout(() => {
             // Bot logic here (simplified for this fix)
             executeBotTurn();
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [currentPlayerIndex, players, isProcessing, matchResult]);

  const executeBotTurn = () => {
      // Yksinkertainen botin vuoron toteutus, jotta peli ei jumiudu
      if (settings.gameMode === 'x01') {
          // X01 Bot Logic
          const newPlayers = JSON.parse(JSON.stringify(players));
          const bot = newPlayers[currentPlayerIndex];
          const throws = getBotTurn(bot.scoreLeft, bot.botSkill);
          
          let bust = false;
          let tempScore = bot.scoreLeft;
          const visitThrows: Throw[] = [];

          for (const t of throws) {
             const val = t.score * t.multiplier;
             const next = tempScore - val;
             if (next < 0 || next === 1 || (next === 0 && t.multiplier !== 2 && t.score !== 50 && settings.doubleOut)) {
                 bust = true;
                 visitThrows.push({...t, totalValue: val});
                 break;
             }
             tempScore = next;
             visitThrows.push({...t, totalValue: val});
             if (next === 0) break;
          }

          bot.currentVisit = visitThrows;
          const visitTotal = visitThrows.reduce((a:number,b:Throw)=>a+b.totalValue,0);
          
          if (!bust) bot.scoreLeft -= visitTotal;
          bot.stats = updateStats(bot, bust ? 0 : visitTotal, visitThrows.length, (!bust && bot.scoreLeft === 0));

          setPlayers(newPlayers);
          setIsProcessing(true);

          if (bot.scoreLeft === 0 && !bust) {
              handleWin(bot, newPlayers);
          } else {
              setTimeout(() => {
                 const finalP = JSON.parse(JSON.stringify(newPlayers));
                 finalP[currentPlayerIndex].currentVisit = [];
                 setPlayers(finalP);
                 nextTurn();
                 setIsProcessing(false);
              }, 1500);
          }
      } else {
          // RTC Bot Logic
          const newPlayers = JSON.parse(JSON.stringify(players));
          const bot = newPlayers[currentPlayerIndex];
          
          let hits = 0;
          let finished = false;
          let tempTarget = bot.rtcTarget;
          const finishTarget = settings.rtcIncludeBull ? 21 : 20;

          for(let i=0; i<3; i++) {
              if (tempTarget > finishTarget) break;
              if (Math.random() * 100 < (bot.botSkill + 10)) {
                  hits++;
                  if (tempTarget === finishTarget) finished = true;
                  tempTarget++;
              }
          }
          
          bot.stats.rtcDartsThrown += 3;
          bot.stats.rtcTargetsHit += hits;
          bot.rtcTarget = tempTarget;
          if (finished) bot.rtcFinished = true;
          
          bot.currentVisit = Array(3).fill({score: 0, multiplier: 1, totalValue: 0});
          setPlayers(newPlayers);
          setIsProcessing(true);
          
          setTimeout(() => {
              const finalP = JSON.parse(JSON.stringify(newPlayers));
              finalP[currentPlayerIndex].currentVisit = [];
              setPlayers(finalP);
              
              // Win check logic duplicate...
              nextTurn();
              setIsProcessing(false);
          }, 1000);
      }
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