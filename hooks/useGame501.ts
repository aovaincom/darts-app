import { useState, useEffect, useRef } from 'react';
import { SavedProfile } from './useProfiles';
import { calculateBotThrow } from '../utils/dartbot'; // Importataan botin aivot

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
  scores60plus: number;
  scores80plus: number;
  scores100plus: number;
  scores120plus: number;
  scores140plus: number;
  scores180: number;
  tonPlusFinishes: number;
  // RTC Stats
  rtcTargetsHit: number; 
  rtcDartsThrown: number;
  rtcSectorHistory: Record<string, { attempts: number; hits: number }>; 
};

export type PlayerState = {
  id: number;
  profileId?: string;
  name: string;
  isBot: boolean; // UUSI: Onko tämä pelaaja botti?
  botSkill: number; // UUSI: Botin taitotaso (1-100)
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

export const useGameLogic = (settings: GameSettings, selectedProfiles: SavedProfile[], botConfig: { count: number, skill: number } | null) => {
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  
  const [legStarterIndex, setLegStarterIndex] = useState(0);
  const [setStarterIndex, setSetStarterIndex] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult>(null);
  const [historyStack, setHistoryStack] = useState<GameHistoryState[]>([]);

  // Tunniste muutoksille (profiilit + botit)
  const profilesHash = selectedProfiles.map(p => p.id).join(',') + `-${botConfig?.count}-${botConfig?.skill}`;

  // Ääni-ref botille
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Alustetaan ääni
    if (typeof window !== 'undefined') {
        audioRef.current = new Audio('/sounds/dart-throw.mp3');
        audioRef.current.volume = 0.5;
    }
  }, []);

  useEffect(() => {
    // Luodaan ihmispelaajat
    const humanPlayers = selectedProfiles.map((profile, index) => createPlayer(index, profile.name, profile.id, false, 0));
    
    // Luodaan botit
    const bots = [];
    if (botConfig && botConfig.count > 0) {
        for (let i = 0; i < botConfig.count; i++) {
            // Jatka ID-numerointia ihmisten jälkeen
            bots.push(createPlayer(humanPlayers.length + i, `DartBot ${i + 1}`, undefined, true, botConfig.skill));
        }
    }

    const allPlayers = [...humanPlayers, ...bots];
    
    // Jos ei pelaajia ollenkaan (alustus), ei tehdä mitään
    if (allPlayers.length === 0) return;

    setPlayers(allPlayers);
    setCurrentPlayerIndex(0); 
    setLegStarterIndex(0);
    setSetStarterIndex(0);
    setMatchResult(null);
    setIsProcessing(false);
    setHistoryStack([]);
  }, [profilesHash, settings.startScore, settings.gameMode, settings.rtcIncludeBull]); // Poistettu riippuvuus botConfigista suoraan loopin estämiseksi

  // Apufunktio pelaajan luontiin
  const createPlayer = (id: number, name: string, profileId: string | undefined, isBot: boolean, botSkill: number): PlayerState => ({
      id,
      profileId,
      name,
      isBot,
      botSkill,
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
  });

  // --- BOTIN VUORO LOGIIKKA ---
  useEffect(() => {
      if (players.length === 0 || matchResult) return;

      const currentPlayer = players[currentPlayerIndex];

      // Jos on botin vuoro, eikä peli ole prosessoinnissa
      if (currentPlayer?.isBot && !isProcessing) {
          
          // Viive ennen heittoa (näyttää luonnollisemmalta)
          const delay = currentPlayer.currentVisit.length === 0 ? 1000 : 800; // Eka tikka hitaampi

          const timer = setTimeout(() => {
              // Lasketaan heitto
              const result = calculateBotThrow(
                  currentPlayer.scoreLeft, 
                  currentPlayer.botSkill, 
                  settings.gameMode, 
                  currentPlayer.rtcTarget
              );

              // Soita ääni
              if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(() => {});
              }

              // Kutsutaan oikeaa käsittelijää pelimuodon mukaan
              if (settings.gameMode === 'x01') {
                  handleDartThrow(result.score, result.multiplier);
              } else {
                  // RTC: Tarkistetaan osuiko tavoitteeseen
                  // CalculateBotThrow palauttaa 25/50 Bullille, käsitellään se
                  let hit = false;
                  const target = currentPlayer.rtcTarget;
                  
                  // Normaalit numerot
                  if (target <= 20 && result.score === target) hit = true;
                  // Bull (21)
                  if (target === 21 && (result.score === 25 || result.score === 50)) hit = true;

                  handleRTCAttempt(hit);
              }

          }, delay);

          return () => clearTimeout(timer);
      }
  }, [currentPlayerIndex, players, isProcessing, matchResult]);


  const resetGame = () => {
    setMatchResult(null);
    setIsProcessing(false);
    setHistoryStack([]);
  };

  const saveStateToHistory = () => {
      setHistoryStack(prev => [
          ...prev, 
          {
              players: JSON.parse(JSON.stringify(players)), 
              currentPlayerIndex,
              legStarterIndex,
              setStarterIndex
          }
      ]);
  };

  const undoLastThrow = () => {
      if (historyStack.length === 0 || isProcessing || matchResult) return;
      // Jos botti on heittämässä, ei voi perua juuri sillä hetkellä
      if (players[currentPlayerIndex].isBot) return; 

      const previousState = historyStack[historyStack.length - 1];
      setPlayers(previousState.players);
      setCurrentPlayerIndex(previousState.currentPlayerIndex);
      setLegStarterIndex(previousState.legStarterIndex);
      setSetStarterIndex(previousState.setStarterIndex);
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
    if (players.length === 0 || matchResult) return;
    
    // Botit eivät rämppää, mutta ihmiset voivat. Estetään ylimääräiset.
    if (!currentPlayer.isBot && (isProcessing || currentPlayer.currentVisit.length >= 3)) return;
    
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

  // --- X01 HANDLER ---
  const handleDartThrow = (score: number, multiplier: number) => {
    const currentPlayer = players[currentPlayerIndex];
    if (players.length === 0 || matchResult) return;
    if (settings.gameMode !== 'x01') return; 
    
    // Botit hallitsevat itse tahtiaan, ihmisille rämppäyksen esto
    if (!currentPlayer.isBot && (isProcessing || currentPlayer.currentVisit.length >= 3)) return;

    saveStateToHistory();
    // Jos ihmispelaaja, lukitaan UI heti. Botille ei tarvitse, koska se käyttää ajastimia.
    if (!currentPlayer.isBot) setIsProcessing(true);

    const totalValue = score * multiplier;
    const newThrow: Throw = { score, multiplier, totalValue };
    const updatedVisit = [...currentPlayer.currentVisit, newThrow];

    const newScoreLeft = currentPlayer.scoreLeft - totalValue;

    let isBust = false;
    if (settings.doubleOut) {
       if (newScoreLeft < 0 || newScoreLeft === 1) isBust = true;
       if (newScoreLeft === 0 && multiplier !== 2 && score !== 50) isBust = true;
    } else {
       if (newScoreLeft < 0) isBust = true;
    }

    if (isBust) {
      // Bust logic...
      // Jos on botti, tehdään tämä ilman ylimääräisiä viiveitä, koska botti itse rytmittää
      setTimeout(() => {
        nextTurn();
        setIsProcessing(false);
      }, 1000);
      return;
    }

    // LEG WIN
    if (newScoreLeft === 0) {
      const updatedPlayers = [...players];
      const winner = updatedPlayers[currentPlayerIndex];

      // Lisätään viimeinen tikka historiaan ennen statsien päivitystä
      // Huom: tässä oikopolku, käytetään visitTotalia joka lasketaan alla
      const visitTotal = updatedVisit.reduce((acc, t) => acc + t.totalValue, 0);

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
        setMatchResult({ winner: winner, players: updatedPlayers, mode: 'x01' });
        setIsProcessing(false);
        return;
      }

      updatedPlayers.forEach(p => { p.scoreLeft = settings.startScore; p.currentVisit = []; });

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
      setIsProcessing(false);
      return; 
    }

    // NORMAL THROW
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex].currentVisit = updatedVisit;
    updatedPlayers[currentPlayerIndex].scoreLeft = newScoreLeft;
    setPlayers(updatedPlayers);

    if (updatedVisit.length === 3) {
      // Botilla on oma rytmi, mutta varmistetaan vuoron vaihto
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
        // Jos ihmispelaaja, vapautetaan lukitus. Botin tapauksessa ei tarvitse.
        if (!currentPlayer.isBot) setIsProcessing(false);
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
    undoLastThrow, 
    canUndo: historyStack.length > 0 && !isProcessing && !(players[currentPlayerIndex]?.isBot)
  };
};