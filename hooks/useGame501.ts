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

  // 2. UNDO / HISTORY
  const saveStateToHistory = () => {
      setHistoryStack(prev => {
          // Emme voi tallentaa 'players' suoraan tässä, koska se voi olla vanha.
          // Mutta Undo on harvinaisempi, joten tämä on ok kompromissi,
          // kunhan itse pelilogiikka käyttää functional updatea.
          return [...prev, { players: JSON.parse(JSON.stringify(players)), currentPlayerIndex, legStarterIndex, setStarterIndex }];
      });
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

  // 3. STATS HELPER (Pure function)
  const calculateStats = (p: PlayerState, visitTotal: number, dartsThrown: number, isCheckout: boolean) => {
      const s = { ...p.stats };
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

  // 4. CORE: X01 THROW
  const handleDartThrow = (score: number, multiplier: number) => {
    if (isProcessing || matchResult) return;
    
    // TÄRKEÄ: Käytämme setPlayers(prev => ...) varmistaaksemme tuoreimman tilan
    setPlayers(prevPlayers => {
        const currentP = prevPlayers[currentPlayerIndex];
        if (currentP.isBot) return prevPlayers; // Bottiheittosuoja

        // 1. Deep Copy nykyisestä tilanteesta (varmistaa React-päivityksen)
        const newPlayers = JSON.parse(JSON.stringify(prevPlayers));
        const p = newPlayers[currentPlayerIndex];

        const totalValue = score * multiplier;
        const newThrow: Throw = { score, multiplier, totalValue };
        p.currentVisit.push(newThrow);
        const newScoreLeft = p.scoreLeft - totalValue;

        // BUST CHECK
        let isBust = false;
        if (settings.doubleOut) {
           if (newScoreLeft < 0 || newScoreLeft === 1 || (newScoreLeft === 0 && multiplier !== 2 && score !== 50)) isBust = true;
        } else {
           if (newScoreLeft < 0) isBust = true;
        }

        if (isBust) {
            // Bust logic: Triggeröidään viive, mutta palautetaan ensin päivitetty tila (näytä heitto)
            triggerTurnChange(1000, true);
            return newPlayers; 
        }

        // WIN CHECK
        if (newScoreLeft === 0) {
            p.scoreLeft = 0;
            const visitTotal = p.currentVisit.reduce((a:number,b:Throw)=>a+b.totalValue,0);
            p.stats = calculateStats(p, visitTotal, p.currentVisit.length, true);
            triggerWin(p.id); // Triggeröidään voitto
            return newPlayers;
        }

        // NORMAL THROW
        p.scoreLeft = newScoreLeft;
        
        // 3 DARTS CHECK
        if (p.currentVisit.length === 3) {
            triggerTurnChange(500, false);
        }

        return newPlayers;
    });
  };

  // 5. CORE: RTC ATTEMPT
  const handleRTCAttempt = (hit: boolean) => {
    if (isProcessing || matchResult) return;

    setPlayers(prevPlayers => {
        const currentP = prevPlayers[currentPlayerIndex];
        if (currentP.isBot) return prevPlayers;
        if (currentP.currentVisit.length >= 3) return prevPlayers;

        const newPlayers = JSON.parse(JSON.stringify(prevPlayers));
        const p = newPlayers[currentPlayerIndex];

        if (p.rtcFinished) {
            triggerTurnChange(100, false);
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
            triggerTurnChangeRTC(500);
        }

        return newPlayers;
    });
  };

  // 6. TURN CHANGE LOGIC (Viiveet)
  const triggerTurnChange = (delay: number, isBust: boolean) => {
      setIsProcessing(true);
      setTimeout(() => {
          setPlayers(prev => {
              const newPlayers = JSON.parse(JSON.stringify(prev));
              const p = newPlayers[currentPlayerIndex];
              
              if (isBust) {
                  // Bust reset: nollaa visit, palauta pisteet (mutta darts thrown jää)
                  p.stats.totalDarts += p.currentVisit.length; 
                  p.currentVisit = [];
                  // scoreLeft on jo oikein (koska emme vähentäneet sitä bustissa pysyvästi tai palautimme sen)
                  // Itseasiassa handleDartThrow ei muuttanut scoreLeftiä pysyvästi bustissa? 
                  // Korjaus: handleDartThrow palautti uuden tilan. Bustissa emme saa muuttaa scoreLeftiä.
                  // Koska handleDartThrowssa on return newPlayers ennen bust-logiikkaa, meidän pitää varmistaa.
              } else {
                  // Normaali 3 tikkaa: Stats päivitys
                  const turnTotal = p.currentVisit.reduce((acc: number, t: Throw) => acc + t.totalValue, 0);
                  p.stats = calculateStats(p, turnTotal, 3, false);
                  p.currentVisit = [];
              }
              
              nextTurn(newPlayers);
              return newPlayers;
          });
          setIsProcessing(false);
      }, delay);
  };

  const triggerTurnChangeRTC = (delay: number) => {
      setIsProcessing(true);
      setTimeout(() => {
          setPlayers(prev => {
              const newPlayers = JSON.parse(JSON.stringify(prev));
              
              // Tarkista voitto
              const isLastPlayer = currentPlayerIndex === newPlayers.length - 1;
              if (isLastPlayer) {
                  const someoneFinished = newPlayers.some((p: PlayerState) => p.rtcFinished);
                  if (someoneFinished) {
                      const finishers = newPlayers.filter((p: PlayerState) => p.rtcFinished);
                      finishers.sort((a: PlayerState, b: PlayerState) => a.stats.rtcDartsThrown - b.stats.rtcDartsThrown);
                      setMatchResult({ winner: finishers[0], players: newPlayers, mode: 'rtc' });
                      setIsProcessing(false);
                      return newPlayers;
                  }
              }

              newPlayers[currentPlayerIndex].currentVisit = [];
              nextTurn(newPlayers);
              return newPlayers;
          });
          setIsProcessing(false);
      }, delay);
  };

  const triggerWin = (winnerId: number) => {
      setIsProcessing(true);
      // Pieni viive jotta viimeinen heitto näkyy
      setTimeout(() => {
          setPlayers(prev => {
              const newPlayers = JSON.parse(JSON.stringify(prev));
              const winner = newPlayers.find((p: PlayerState) => p.id === winnerId);
              
              winner.legsWon++;
              let matchWon = false;
              let setFinished = false;

              if (settings.matchMode === 'sets') {
                if (winner.legsWon >= settings.legsPerSet) {
                    setFinished = true;
                    winner.setsWon++;
                    newPlayers.forEach((pl: PlayerState) => pl.legsWon = 0);
                    if (winner.setsWon >= settings.targetToWin) matchWon = true;
                }
              } else {
                  if (winner.legsWon >= settings.targetToWin) matchWon = true;
              }
              
              if (matchWon) {
                  setMatchResult({ winner, players: newPlayers, mode: 'x01' });
                  setIsProcessing(false);
                  return newPlayers;
              }

              // Uusi leg
              const nextStarter = setFinished 
                ? (setStarterIndex + 1) % newPlayers.length
                : (legStarterIndex + 1) % newPlayers.length;
              
              if (setFinished) { setSetStarterIndex(nextStarter); setLegStarterIndex(nextStarter); }
              else { setLegStarterIndex(nextStarter); }

              newPlayers.forEach((pl: PlayerState) => { pl.scoreLeft = settings.startScore; pl.currentVisit = []; });
              setCurrentPlayerIndex(nextStarter);
              return newPlayers;
          });
          setIsProcessing(false);
      }, 2000);
  };

  const nextTurn = (currentPlayers: PlayerState[]) => {
      const nextIndex = (currentPlayerIndex + 1) % currentPlayers.length;
      setCurrentPlayerIndex(nextIndex);
  };

  // 7. BOT AI (Effect loop)
  useEffect(() => {
      if (players.length === 0 || matchResult) return;
      const currentPlayer = players[currentPlayerIndex];

      if (currentPlayer && currentPlayer.isBot && !isProcessing) {
          const timer = setTimeout(() => {
              if (settings.gameMode === 'x01') executeBotX01();
              else executeBotRTC();
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [currentPlayerIndex, players, isProcessing, matchResult]);

  const executeBotX01 = () => {
      setIsProcessing(true);
      // Lasketaan heitot 'lennossa', mutta päivitetään tila functional updatella
      const bot = players[currentPlayerIndex]; // Tämä on safe lukea tässä kohtaa effectiä
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

      // Päivitä tila
      setPlayers(prev => {
          const newPlayers = JSON.parse(JSON.stringify(prev));
          const p = newPlayers[currentPlayerIndex];
          
          p.currentVisit = visitThrows;
          
          // Laske statsit ja pisteet
          const visitTotal = visitThrows.reduce((a:number,b:Throw)=>a+b.totalValue,0);
          if (!bust) p.scoreLeft -= visitTotal;
          p.stats = calculateStats(p, bust ? 0 : visitTotal, visitThrows.length, (!bust && p.scoreLeft === 0));

          if (p.scoreLeft === 0 && !bust) {
             triggerWin(p.id);
          } else {
             // Turn change
             setTimeout(() => {
                 setPlayers(innerPrev => {
                     const finalP = JSON.parse(JSON.stringify(innerPrev));
                     finalP[currentPlayerIndex].currentVisit = [];
                     nextTurn(finalP);
                     return finalP;
                 });
                 setIsProcessing(false);
             }, 1500);
          }
          return newPlayers;
      });
  };

  const executeBotRTC = () => {
      setIsProcessing(true);
      const bot = players[currentPlayerIndex];
      
      let hits = 0;
      let finished = false;
      // Simuloidaan botin tilaa paikallisesti jotta voidaan laskea heitot
      let tempTarget = bot.rtcTarget;
      const finishTarget = settings.rtcIncludeBull ? 21 : 20;

      for (let i=0; i<3; i++) {
          if (tempTarget > finishTarget) break; 
          const roll = Math.random() * 100;
          if (roll < (bot.botSkill + 10)) {
              hits++;
              if (tempTarget === finishTarget) {
                  finished = true;
                  break; 
              }
              tempTarget++;
          }
      }

      setPlayers(prev => {
          const newPlayers = JSON.parse(JSON.stringify(prev));
          const p = newPlayers[currentPlayerIndex];
          
          p.stats.rtcDartsThrown += 3;
          p.stats.rtcTargetsHit += hits;
          if (finished) p.rtcFinished = true;
          p.rtcTarget = tempTarget; // Päivitä target
          p.currentVisit = Array(3).fill({score: 0, multiplier: 1, totalValue: 0});

          setTimeout(() => {
              triggerTurnChangeRTC(0); // Käytetään RTC logiikkaa
          }, 1000);
          
          return newPlayers;
      });
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