"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dartboard } from "../components/Dartboard";
import { getCheckoutGuide } from "../utils/checkouts";
import { useProfiles, SavedProfile, HistoryEntry } from "../hooks/useProfiles";
import { getBotTurn } from "../utils/dartbot";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- TYYPIT ---
type Throw = {
  score: number;
  multiplier: number;
  totalValue: number;
};

type PlayerStats = {
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
  // Historia
  historyX01?: HistoryEntry[];
  historyRTC?: HistoryEntry[];
  gamesPlayed?: number;
  rtcGamesPlayed?: number;
  rtcBestDarts?: number;
  rtcTotalThrows?: number;
  rtcTotalHits?: number;
  rtcSectorStats?: Record<string, { attempts: number; hits: number }>;
};

type PlayerState = {
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

type MatchResult = {
  winner: PlayerState;
  players: PlayerState[];
  mode: 'x01' | 'rtc';
} | null;

// --- STATS MODAL (Korjattu: Ikkunan valinta ja responsiivisuus) ---
const calculateRollingStats = (history: HistoryEntry[], windowSize: number) => {
    if (!history || history.length === 0) return [];
    return history.map((entry, index) => {
        const start = Math.max(0, index - windowSize + 1);
        const subset = history.slice(start, index + 1);
        const sum = subset.reduce((acc, curr) => acc + (curr.gameValue ?? (curr.value || 0)), 0);
        return {
            gameIndex: index + 1, 
            rolling: parseFloat((sum / subset.length).toFixed(2)),
            cumulative: entry.cumulativeValue ?? (entry.value || 0)
        };
    });
};

const StatsModal = ({ profile, onClose }: { profile: SavedProfile, onClose: () => void }) => {
    const [tab, setTab] = useState<'x01' | 'rtc'>('x01');
    // PALAUTETTU: Mahdollisuus säätää keskiarvon ikkunaa
    const [rollingWindow, setRollingWindow] = useState(10);
    
    const x01Data = useMemo(() => calculateRollingStats(profile.stats.historyX01 || [], rollingWindow), [profile, rollingWindow]);
    const rtcData = useMemo(() => calculateRollingStats(profile.stats.historyRTC || [], rollingWindow), [profile, rollingWindow]);

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl border border-slate-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between bg-slate-900">
                    <h2 className="text-2xl font-bold text-white">{profile.name} Stats</h2>
                    <button onClick={onClose} className="text-3xl text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="flex bg-slate-800 border-b border-slate-700">
                    <button onClick={() => setTab('x01')} className={`flex-1 py-3 font-bold ${tab==='x01' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-400'}`}>X01</button>
                    <button onClick={() => setTab('rtc')} className={`flex-1 py-3 font-bold ${tab==='rtc' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>RTC</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {tab === 'x01' ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-slate-900 p-4 rounded border border-slate-700 text-center"><div className="text-gray-500 text-xs">AVG</div><div className="text-2xl font-bold text-blue-400">{((profile.stats.totalScore / (profile.stats.totalDarts||1))*3).toFixed(2)}</div></div>
                                <div className="bg-slate-900 p-4 rounded border border-slate-700 text-center"><div className="text-gray-500 text-xs">180s</div><div className="text-2xl font-bold text-red-500">{profile.stats.scores180}</div></div>
                                <div className="bg-slate-900 p-4 rounded border border-slate-700 text-center"><div className="text-gray-500 text-xs">High Out</div><div className="text-2xl font-bold text-orange-400">{profile.stats.highestCheckout}</div></div>
                                <div className="bg-slate-900 p-4 rounded border border-slate-700 text-center"><div className="text-gray-500 text-xs">Games</div><div className="text-2xl font-bold text-white">{profile.stats.gamesPlayed}</div></div>
                            </div>
                            <div className="bg-slate-900 p-4 rounded border border-slate-700">
                                <div className="flex justify-between mb-4">
                                    <h3 className="text-sm text-gray-400">Progress (Rolling Avg)</h3>
                                    <select value={rollingWindow} onChange={e => setRollingWindow(Number(e.target.value))} className="bg-slate-800 text-white text-xs border border-slate-600 rounded">
                                        <option value="5">5 Games</option>
                                        <option value="10">10 Games</option>
                                        <option value="20">20 Games</option>
                                    </select>
                                </div>
                                <div style={{ width: '100%', height: 300 }}>
                                    {x01Data.length > 1 ? (
                                        <ResponsiveContainer>
                                            <LineChart data={x01Data}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                                <XAxis dataKey="gameIndex" />
                                                <YAxis domain={['auto', 'auto']} />
                                                <Tooltip contentStyle={{backgroundColor: '#1e293b'}} />
                                                <Legend />
                                                <Line type="monotone" name="Rolling" dataKey="rolling" stroke="#4ade80" strokeWidth={2} dot={false} />
                                                <Line type="monotone" name="Cumulative" dataKey="cumulative" stroke="#facc15" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : <div className="text-center text-gray-500 pt-10">Play more games to see graph</div>}
                                </div>
                            </div>
                        </>
                    ) : (
                        // RTC STATS
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="bg-slate-900 p-4 rounded border border-slate-700 text-center"><div className="text-gray-500 text-xs">Games</div><div className="text-2xl font-bold text-white">{profile.stats.rtcGamesPlayed || 0}</div></div>
                                <div className="bg-slate-900 p-4 rounded border border-slate-700 text-center"><div className="text-gray-500 text-xs">Best Darts</div><div className="text-2xl font-bold text-green-400">{profile.stats.rtcBestDarts || '-'}</div></div>
                                <div className="bg-slate-900 p-4 rounded border border-slate-700 text-center"><div className="text-gray-500 text-xs">Hit %</div><div className="text-2xl font-bold text-blue-400">{(profile.stats.rtcTotalThrows ? ((profile.stats.rtcTotalHits||0)/profile.stats.rtcTotalThrows*100).toFixed(1) : 0)}%</div></div>
                            </div>
                             <div className="bg-slate-900 p-4 rounded border border-slate-700 mt-4">
                                <div className="flex justify-between mb-4">
                                    <h3 className="text-sm text-gray-400">Hit % Progress</h3>
                                    <select value={rollingWindow} onChange={e => setRollingWindow(Number(e.target.value))} className="bg-slate-800 text-white text-xs border border-slate-600 rounded">
                                        <option value="5">5 Games</option>
                                        <option value="10">10 Games</option>
                                    </select>
                                </div>
                                <div style={{ width: '100%', height: 300 }}>
                                    {rtcData.length > 1 ? (
                                        <ResponsiveContainer>
                                            <LineChart data={rtcData}>
                                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                                <XAxis dataKey="gameIndex" />
                                                <YAxis domain={[0, 100]} />
                                                <Tooltip contentStyle={{backgroundColor: '#1e293b'}} />
                                                <Legend />
                                                <Line type="monotone" name="Rolling %" dataKey="rolling" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : <div className="text-center text-gray-500 pt-10">Play more games</div>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- PÄÄKOMPONENTTI (HOME) ---
export default function Home() {
  const { profiles, createProfile, deleteProfile, updateManyProfiles, getAverage, exportStatsToCSV } = useProfiles();
  
  // UI State
  const [newProfileName, setNewProfileName] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<SavedProfile | null>(null);
  
  // Game Settings
  const [settings, setSettings] = useState({
    gameMode: 'x01' as 'x01' | 'rtc',
    startScore: 501,
    doubleIn: false,
    doubleOut: true,
    playerCount: 2,
    matchMode: 'legs' as 'legs' | 'sets',
    targetToWin: 3,
    legsPerSet: 3,
    rtcIncludeBull: true,
  });
  const [botConfig, setBotConfig] = useState({ count: 0, skill: 50 });

  // --- GAME STATE ---
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [legStarterIndex, setLegStarterIndex] = useState(0);
  const [setStarterIndex, setSetStarterIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult>(null);

  // --- GAME LOGIC ---

  const startGame = () => {
    const humanPlayers = selectedProfileIds
        .map(id => profiles.find(p => p.id === id))
        .filter((p): p is SavedProfile => !!p)
        .map((p, i) => createPlayerObj(i, p.name, false, 0, p.id));
    
    const bots = [];
    for(let i=0; i<botConfig.count; i++) {
        bots.push(createPlayerObj(humanPlayers.length + i, `Dartbot ${i+1}`, true, botConfig.skill));
    }

    setPlayers([...humanPlayers, ...bots]);
    setCurrentPlayerIndex(0);
    setLegStarterIndex(0);
    setSetStarterIndex(0);
    setMatchResult(null);
    setIsProcessing(false);
    setGameStarted(true);
  };

  const createPlayerObj = (id: number, name: string, isBot: boolean, skill: number, profileId?: string): PlayerState => ({
      id, profileId, name, isBot, botSkill: skill,
      scoreLeft: settings.startScore,
      rtcTarget: 1, rtcFinished: false,
      setsWon: 0, legsWon: 0,
      history: [], currentVisit: [],
      stats: { average: 0, totalScore: 0, totalDarts: 0, highestCheckout: 0, scores60plus: 0, scores80plus: 0, scores100plus: 0, scores120plus: 0, scores140plus: 0, scores180: 0, tonPlusFinishes: 0, rtcTargetsHit: 0, rtcDartsThrown: 0, rtcSectorHistory: {} }
  });

  const calculateStats = (p: PlayerState, visitTotal: number, dartsCount: number, isCheckout: boolean) => {
      const s = { ...p.stats };
      if (settings.gameMode === 'x01') {
          s.totalScore += visitTotal;
          s.totalDarts += dartsCount;
          s.average = parseFloat(((s.totalScore / s.totalDarts) * 3).toFixed(2));
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

  // 3. X01 Logic
  const handleX01Throw = (score: number, multiplier: number) => {
      if (isProcessing || matchResult) return;
      
      setPlayers(prev => {
          const newPlayers = JSON.parse(JSON.stringify(prev));
          const p = newPlayers[currentPlayerIndex];
          if (p.isBot) return prev; 

          const val = score * multiplier;
          p.currentVisit.push({ score, multiplier, totalValue: val });
          const nextScore = p.scoreLeft - val;

          // Bust Check
          let bust = false;
          if (nextScore < 0 || nextScore === 1 || (nextScore === 0 && multiplier !== 2 && score !== 50 && settings.doubleOut)) {
              bust = true;
          }

          if (bust) {
              setIsProcessing(true);
              setTimeout(() => {
                  setPlayers(bustPrev => {
                      const bustPlayers = JSON.parse(JSON.stringify(bustPrev));
                      const bp = bustPlayers[currentPlayerIndex];
                      bp.stats.totalDarts += bp.currentVisit.length;
                      bp.currentVisit = [];
                      // Change Turn
                      setCurrentPlayerIndex((currentPlayerIndex + 1) % bustPlayers.length);
                      return bustPlayers;
                  });
                  setIsProcessing(false);
              }, 1000);
              return newPlayers; 
          }

          // Win Check
          if (nextScore === 0) {
              p.scoreLeft = 0;
              const turnTotal = p.currentVisit.reduce((a:number,b:Throw)=>a+b.totalValue,0);
              p.stats = calculateStats(p, turnTotal, p.currentVisit.length, true);
              handleWin(p, newPlayers); // Trigger Win
              return newPlayers;
          }

          // Continue
          p.scoreLeft = nextScore;
          if (p.currentVisit.length === 3) {
              setIsProcessing(true);
              setTimeout(() => {
                  setPlayers(turnPrev => {
                      const turnPlayers = JSON.parse(JSON.stringify(turnPrev));
                      const tp = turnPlayers[currentPlayerIndex];
                      const turnTotal = tp.currentVisit.reduce((a:number,b:Throw)=>a+b.totalValue,0);
                      tp.stats = calculateStats(tp, turnTotal, 3, false);
                      tp.currentVisit = [];
                      setCurrentPlayerIndex((currentPlayerIndex + 1) % turnPlayers.length);
                      return turnPlayers;
                  });
                  setIsProcessing(false);
              }, 500);
          }
          return newPlayers;
      });
  };

  // 4. RTC Logic
  const handleRTCThrow = (hit: boolean) => {
      if (isProcessing || matchResult) return;
      
      setPlayers(prev => {
          const newPlayers = JSON.parse(JSON.stringify(prev));
          const p = newPlayers[currentPlayerIndex];
          if (p.isBot) return prev;

          if (p.rtcFinished) {
               setIsProcessing(true);
               setTimeout(() => {
                   p.currentVisit = [];
                   setCurrentPlayerIndex((currentPlayerIndex + 1) % newPlayers.length);
                   setIsProcessing(false);
               }, 100);
               return newPlayers;
          }

          p.stats.rtcDartsThrown++;
          if (hit) {
              p.stats.rtcTargetsHit++;
              const finishTarget = settings.rtcIncludeBull ? 21 : 20;
              if (p.rtcTarget === finishTarget) p.rtcFinished = true;
              else p.rtcTarget++;
          }
          
          p.currentVisit.push({ score: hit ? p.rtcTarget : 0, multiplier: 1, totalValue: 0 });

          if (p.rtcFinished || p.currentVisit.length === 3) {
              setIsProcessing(true);
              setTimeout(() => {
                 setPlayers(finalPrev => {
                     const finalPlayers = JSON.parse(JSON.stringify(finalPrev));
                     finalPlayers[currentPlayerIndex].currentVisit = [];
                     
                     // Check Match End
                     const isLast = currentPlayerIndex === finalPlayers.length - 1;
                     if (isLast) {
                         const finishers = finalPlayers.filter((pl: PlayerState) => pl.rtcFinished);
                         if (finishers.length > 0) {
                             finishers.sort((a:PlayerState,b:PlayerState) => a.stats.rtcDartsThrown - b.stats.rtcDartsThrown);
                             // PALAUTETTU: MatchResult asetetaan, jotta Game Over -ruutu aukeaa
                             setMatchResult({ winner: finishers[0], players: finalPlayers, mode: 'rtc' });
                             return finalPlayers;
                         }
                     }

                     setCurrentPlayerIndex((currentPlayerIndex + 1) % finalPlayers.length);
                     return finalPlayers;
                 });
                 setIsProcessing(false);
              }, 500);
          }
          return newPlayers;
      });
  };

  // 5. Win Handler (Korjattu näyttämään Game Over)
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
          setMatchResult({ winner, players: currentPlayers, mode: 'x01' });
      } else {
          // New Leg
          setIsProcessing(true);
          setTimeout(() => {
              setPlayers(prev => {
                  const resetP = JSON.parse(JSON.stringify(prev));
                  const nextStarter = setFinished 
                    ? (setStarterIndex + 1) % resetP.length
                    : (legStarterIndex + 1) % resetP.length;
                  
                  if (setFinished) { setSetStarterIndex(nextStarter); setLegStarterIndex(nextStarter); }
                  else { setLegStarterIndex(nextStarter); }

                  resetP.forEach((pl: PlayerState) => { pl.scoreLeft = settings.startScore; pl.currentVisit = []; });
                  setCurrentPlayerIndex(nextStarter);
                  return resetP;
              });
              setIsProcessing(false);
          }, 2000);
      }
  };

  // 6. Bot Loop
  useEffect(() => {
      if (!gameStarted || matchResult || players.length === 0) return;
      const currentPlayer = players[currentPlayerIndex];

      if (currentPlayer?.isBot && !isProcessing) {
          const timer = setTimeout(() => {
              if (settings.gameMode === 'x01') {
                   const throws = getBotTurn(currentPlayer.scoreLeft, currentPlayer.botSkill);
                   setPlayers(prev => {
                       const newP = JSON.parse(JSON.stringify(prev));
                       const bot = newP[currentPlayerIndex];
                       
                       let bust = false;
                       let tempS = bot.scoreLeft;
                       const visit: Throw[] = [];
                       
                       for (const t of throws) {
                           const val = t.score * t.multiplier;
                           const next = tempS - val;
                           if (next < 0 || next === 1 || (next === 0 && t.multiplier !== 2 && t.score !== 50 && settings.doubleOut)) {
                               bust = true;
                               visit.push({...t, totalValue: val});
                               break;
                           }
                           tempS = next;
                           visit.push({...t, totalValue: val});
                           if (next === 0) break;
                       }
                       
                       bot.currentVisit = visit;
                       const vTotal = visit.reduce((a:number,b:Throw)=>a+b.totalValue,0);
                       if (!bust) bot.scoreLeft -= vTotal;
                       bot.stats = calculateStats(bot, bust ? 0 : vTotal, visit.length, (!bust && bot.scoreLeft===0));
                       
                       if (bot.scoreLeft === 0 && !bust) {
                           handleWin(bot, newP);
                       } else {
                           setIsProcessing(true);
                           setTimeout(() => {
                               setPlayers(nextPrev => {
                                   const nextP = JSON.parse(JSON.stringify(nextPrev));
                                   nextP[currentPlayerIndex].currentVisit = [];
                                   setCurrentPlayerIndex((currentPlayerIndex + 1) % nextP.length);
                                   return nextP;
                               });
                               setIsProcessing(false);
                           }, 1500);
                       }
                       return newP;
                   });
              } else {
                   // RTC Bot
                   setPlayers(prev => {
                       const newP = JSON.parse(JSON.stringify(prev));
                       const bot = newP[currentPlayerIndex];
                       let hits = 0;
                       let finished = false;
                       let tempT = bot.rtcTarget;
                       for(let i=0; i<3; i++) {
                           if (tempT > (settings.rtcIncludeBull?21:20)) break;
                           if (Math.random()*100 < (bot.botSkill+10)) {
                               hits++;
                               if (tempT === (settings.rtcIncludeBull?21:20)) finished = true;
                               tempT++;
                           }
                       }
                       bot.stats.rtcDartsThrown += 3;
                       bot.stats.rtcTargetsHit += hits;
                       bot.rtcTarget = tempT;
                       if (finished) bot.rtcFinished = true;
                       
                       bot.currentVisit = Array(3).fill({score:0, multiplier:1, totalValue:0});
                       
                       setIsProcessing(true);
                       setTimeout(() => {
                            setPlayers(nextPrev => {
                                   const nextP = JSON.parse(JSON.stringify(nextPrev));
                                   nextP[currentPlayerIndex].currentVisit = [];
                                   
                                    // Check Win for Bot
                                    const isLast = currentPlayerIndex === nextP.length - 1;
                                    if (isLast) {
                                        const finishers = nextP.filter((pl: PlayerState) => pl.rtcFinished);
                                        if (finishers.length > 0) {
                                            finishers.sort((a:PlayerState,b:PlayerState) => a.stats.rtcDartsThrown - b.stats.rtcDartsThrown);
                                            setMatchResult({ winner: finishers[0], players: nextP, mode: 'rtc' });
                                            setIsProcessing(false);
                                            return nextP;
                                        }
                                    }

                                   setCurrentPlayerIndex((currentPlayerIndex + 1) % nextP.length);
                                   return nextP;
                            });
                            setIsProcessing(false);
                       }, 1000);
                       return newP;
                   });
              }
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [currentPlayerIndex, gameStarted, isProcessing, matchResult]);

  const saveAndExit = () => {
    const updates: any[] = [];
    players.forEach(p => {
        if (!p.isBot && p.profileId) {
            if (settings.gameMode === 'x01') {
                updates.push({ id: p.profileId, stats: { 
                    gamesPlayed: 1, 
                    totalScore: p.stats.totalScore, 
                    totalDarts: p.stats.totalDarts, 
                    highestCheckout: p.stats.highestCheckout,
                    scores180: p.stats.scores180 
                }});
            } else {
                updates.push({ id: p.profileId, stats: {
                    rtcGamesPlayed: 1,
                    rtcTotalThrows: p.stats.rtcDartsThrown,
                    rtcTotalHits: p.stats.rtcTargetsHit
                }});
            }
        }
    });
    updateManyProfiles(updates);
    setGameStarted(false);
    setSelectedProfileIds([]);
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex overflow-hidden font-sans">
      {viewingProfile && <StatsModal profile={viewingProfile} onClose={() => setViewingProfile(null)} />}

      {!gameStarted ? (
        <div className="min-h-screen w-full overflow-auto bg-slate-900 p-4 flex flex-col items-center">
            <h1 className="text-4xl font-bold mb-8 text-orange-500 mt-8">DARTS PRO CENTER</h1>
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-green-400">Select Players</h2> <button onClick={exportStatsToCSV} className="text-xs bg-slate-700 px-2 py-1 rounded">CSV</button></div>
                    <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                        {profiles.map(p => (
                            <div key={p.id} className={`p-3 rounded flex justify-between items-center cursor-pointer border ${selectedProfileIds.includes(p.id) ? 'bg-green-900/50 border-green-500' : 'bg-slate-700 border-transparent'}`} onClick={() => {
                                if (selectedProfileIds.includes(p.id)) setSelectedProfileIds(prev => prev.filter(id => id !== p.id));
                                else setSelectedProfileIds(prev => [...prev, p.id]);
                            }}>
                                <div><div className="font-bold">{p.name}</div><div className="text-xs text-gray-400">Avg: {((p.stats.totalScore / (p.stats.totalDarts||1))*3).toFixed(1)}</div></div>
                                <button onClick={(e) => {e.stopPropagation(); setViewingProfile(p);}} className="bg-slate-600 px-2 py-1 rounded text-xs">STATS</button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2"><input value={newProfileName} onChange={e => setNewProfileName(e.target.value)} className="bg-slate-900 border border-slate-600 rounded px-2 flex-1" placeholder="Name..." /><button onClick={()=>{createProfile(newProfileName); setNewProfileName("")}} className="bg-blue-600 px-4 rounded">Add</button></div>
                </div>
                
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                     <h2 className="text-xl font-bold text-orange-400 mb-4">Settings</h2>
                     <div className="flex gap-2 mb-4">
                         <button onClick={()=>setSettings(s=>({...s, gameMode:'x01'}))} className={`flex-1 py-2 rounded border ${settings.gameMode==='x01'?'bg-slate-700 border-green-500':'bg-slate-900 border-transparent'}`}>X01</button>
                         <button onClick={()=>setSettings(s=>({...s, gameMode:'rtc'}))} className={`flex-1 py-2 rounded border ${settings.gameMode==='rtc'?'bg-slate-700 border-blue-500':'bg-slate-900 border-transparent'}`}>RTC</button>
                     </div>
                     {settings.gameMode === 'x01' && (
                         <>
                            <div className="flex gap-2 mb-4">
                                {[301,501,701].map(sc => <button key={sc} onClick={()=>setSettings(s=>({...s, startScore: sc as any}))} className={`flex-1 py-1 rounded ${settings.startScore===sc?'bg-orange-500':'bg-slate-700'}`}>{sc}</button>)}
                            </div>
                            {/* PALAUTETTU: LEGS / SETS VALINTA */}
                            <div className="flex gap-2 mb-4 bg-slate-700 p-1 rounded">
                                <button onClick={() => setSettings(s=>({...s, matchMode: 'legs'}))} className={`flex-1 py-1 rounded ${settings.matchMode === 'legs' ? 'bg-slate-500 text-white' : 'text-gray-400'}`}>Legs</button>
                                <button onClick={() => setSettings(s=>({...s, matchMode: 'sets'}))} className={`flex-1 py-1 rounded ${settings.matchMode === 'sets' ? 'bg-slate-500 text-white' : 'text-gray-400'}`}>Sets</button>
                            </div>
                            <div className="flex justify-between items-center mb-4 bg-slate-900/50 p-2 rounded">
                                <span className="text-sm">To Win ({settings.matchMode}): {settings.targetToWin}</span>
                                <div className="flex gap-1"><button onClick={()=>setSettings(s=>({...s, targetToWin:Math.max(1,s.targetToWin-1)}))} className="w-8 bg-slate-600 rounded">-</button><button onClick={()=>setSettings(s=>({...s, targetToWin:s.targetToWin+1}))} className="w-8 bg-slate-600 rounded">+</button></div>
                            </div>
                         </>
                     )}
                     <div className="bg-slate-900/50 p-4 rounded mb-4">
                         <div className="flex justify-between items-center mb-2"><span className="text-gray-400">Add Bot</span> <div className="flex gap-2"><button onClick={()=>setBotConfig(b=>({...b, count: Math.max(0,b.count-1)}))} className="bg-slate-700 w-8 rounded">-</button><span>{botConfig.count}</span><button onClick={()=>setBotConfig(b=>({...b, count: Math.min(1,b.count+1)}))} className="bg-slate-700 w-8 rounded">+</button></div></div>
                         {botConfig.count>0 && <input type="range" min="20" max="100" value={botConfig.skill} onChange={e=>setBotConfig(b=>({...b, skill: Number(e.target.value)}))} className="w-full" />}
                     </div>
                     <button onClick={startGame} disabled={selectedProfileIds.length===0} className="w-full bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold text-xl disabled:opacity-50">START GAME</button>
                </div>
            </div>
        </div>
      ) : (
        // GAME SCREEN
        <>
            <div className="w-1/3 min-w-[300px] bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800 font-bold text-orange-500">{settings.gameMode==='x01'?'GAME ON':'ROUND THE CLOCK'}</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {players.map((p, i) => (
                        <div key={i} className={`p-4 rounded-xl border-l-4 ${i===currentPlayerIndex ? 'bg-slate-800 border-green-500 shadow' : 'bg-slate-900/50 border-slate-700 opacity-60'}`}>
                            <div className="flex justify-between">
                                <div>
                                    <div className="font-bold text-lg">{p.name} {p.isBot && <span className="text-xs bg-blue-900 px-1 rounded">BOT</span>}</div>
                                    <div className="text-xs text-gray-400 font-mono">
                                        {/* PALAUTETTU: In-Game Avg ja Prosentit */}
                                        {settings.gameMode==='x01' 
                                            ? `Avg: ${p.stats.average}` 
                                            : `Darts: ${p.stats.rtcDartsThrown} (${p.stats.rtcDartsThrown > 0 ? Math.round((p.stats.rtcTargetsHit/p.stats.rtcDartsThrown)*100) : 0}%)`
                                        }
                                    </div>
                                    <div className="flex gap-1 mt-1 h-5">
                                        {p.currentVisit.map((t, idx) => (
                                            <div key={idx} className="bg-slate-700 px-1 rounded text-[10px] text-white flex items-center">{t.multiplier>1?(t.multiplier===3?'T':'D'):''}{t.score}</div>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-mono font-bold">{settings.gameMode==='x01' ? p.scoreLeft : (p.rtcFinished?'DONE':(p.rtcTarget===21?'BULL':p.rtcTarget))}</div>
                                    <div className="text-xs text-gray-500">
                                        {settings.matchMode === 'sets' ? `S:${p.setsWon} L:${p.legsWon}` : `Legs: ${p.legsWon}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center relative p-4">
                 <button onClick={saveAndExit} className="absolute top-4 right-4 bg-red-900/50 border border-red-800 px-4 py-2 rounded text-red-200 font-bold">EXIT</button>
                 
                 <div className="mb-4 text-center">
                     <h2 className="text-4xl font-bold text-white">{players[currentPlayerIndex]?.name}</h2>
                     <p className="text-blue-500 tracking-widest text-sm uppercase">{players[currentPlayerIndex]?.isBot ? 'Bot Throwing...' : 'Throw Darts'}</p>
                 </div>

                 <div className="scale-90 lg:scale-100 mb-6">
                     {settings.gameMode === 'x01' ? (
                         <Dartboard onThrow={handleX01Throw} currentUserId={players[currentPlayerIndex]?.id} />
                     ) : (
                         <div className="flex flex-col gap-4 w-64">
                             <div className="text-6xl font-bold text-white text-center font-mono bg-slate-800 p-8 rounded-2xl border-4 border-blue-500">
                                 {players[currentPlayerIndex]?.rtcTarget === 21 ? 'BULL' : players[currentPlayerIndex]?.rtcTarget}
                             </div>
                             <div className="flex gap-2">
                                 <button onClick={()=>handleRTCThrow(false)} className="flex-1 h-24 bg-red-900/40 border-2 border-red-600/50 rounded-xl text-4xl text-red-200">X</button>
                                 <button onClick={()=>handleRTCThrow(true)} className="flex-1 h-24 bg-green-900/40 border-2 border-green-500/50 rounded-xl text-4xl text-green-200">✓</button>
                             </div>
                         </div>
                     )}
                 </div>

                 {settings.gameMode === 'x01' && (
                     <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex justify-between items-center w-full max-w-sm">
                         <span className="text-gray-400">Checkout</span>
                         <span className="text-2xl font-bold text-green-400 font-mono">{getCheckoutGuide(players[currentPlayerIndex]?.scoreLeft) || '-'}</span>
                     </div>
                 )}
            </div>
        </>
      )}

      {/* PALAUTETTU: GAME OVER MODAL TOIMIVAKSI */}
      {matchResult && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur z-50 flex items-center justify-center p-4">
              <div className="bg-slate-800 p-8 rounded-2xl border-2 border-orange-500 w-full max-w-2xl text-center">
                  <h1 className="text-5xl font-bold text-white mb-4">GAME OVER</h1>
                  <h2 className="text-2xl text-green-400 mb-8">Winner: {matchResult.winner.name}</h2>
                  
                  <div className="mb-6 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-700 text-gray-400">
                                <th className="p-2">Player</th>
                                {matchResult.mode === 'x01' ? (
                                    <>
                                        <th className="p-2">Avg</th>
                                        <th className="p-2">Best Out</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-2">Darts</th>
                                        <th className="p-2">Hit %</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {matchResult.players.map(p => (
                                <tr key={p.id} className="border-b border-slate-700/50 text-white">
                                    <td className="p-2 font-bold">{p.name}</td>
                                    {matchResult.mode === 'x01' ? (
                                        <>
                                            <td className="p-2">{p.stats.average}</td>
                                            <td className="p-2">{p.stats.highestCheckout}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-2">{p.stats.rtcDartsThrown}</td>
                                            <td className="p-2">{p.stats.rtcDartsThrown > 0 ? Math.round((p.stats.rtcTargetsHit/p.stats.rtcDartsThrown)*100) : 0}%</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>

                  <button onClick={saveAndExit} className="bg-slate-700 hover:bg-slate-600 px-8 py-4 rounded-xl font-bold text-white w-full">Back to Menu</button>
              </div>
          </div>
      )}
    </div>
  );
}