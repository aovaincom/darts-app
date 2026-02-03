"use client";

import { useState, useMemo } from "react";
import { useGameLogic, GameSettings } from "../hooks/useGame501";
import { useProfiles, SavedProfile, HistoryEntry } from "../hooks/useProfiles";
import { Dartboard } from "../components/Dartboard";
import { getCheckoutGuide } from "../utils/checkouts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// ... (calculateRollingStats ja ProfileStatsModal funktiot PYSYVÄT SAMOINA, kopioi ne tähän)
// ... Käytä edellistä versiota näiden kahden funktion osalta.

// --- TÄMÄ ON APUFUNKTIO RULLAAVALLE KESKIARVOLLE (Sama kuin ennen) ---
const calculateRollingStats = (history: HistoryEntry[], windowSize: number) => {
    return history.map((entry, index) => {
        const start = Math.max(0, index - windowSize + 1);
        const subset = history.slice(start, index + 1);
        
        const sum = subset.reduce((acc, curr) => {
            const val = curr.gameValue !== undefined ? curr.gameValue : (curr.value || 0);
            return acc + val;
        }, 0);
        
        const rollingAvg = sum / subset.length;

        const singleGameVal = entry.gameValue !== undefined ? entry.gameValue : (entry.value || 0);
        const cumVal = entry.cumulativeValue !== undefined ? entry.cumulativeValue : (entry.value || 0);

        return {
            gameIndex: index + 1, 
            gameValue: singleGameVal,
            rolling: parseFloat(rollingAvg.toFixed(2)),
            cumulative: cumVal
        };
    });
};

// --- PROFIILI MODAALI (Sama kuin ennen) ---
const ProfileStatsModal = ({ profile, onClose }: { profile: SavedProfile, onClose: () => void }) => {
    // ... Kopioi sisältö edellisestä vastauksesta ...
    const [tab, setTab] = useState<'x01' | 'rtc'>('x01');
    const [rollingWindow, setRollingWindow] = useState(10); 

    const x01GraphData = useMemo(() => {
        return calculateRollingStats(profile.stats.historyX01 || [], rollingWindow);
    }, [profile.stats.historyX01, rollingWindow]);

    const rtcGraphData = useMemo(() => {
        return calculateRollingStats(profile.stats.historyRTC || [], rollingWindow);
    }, [profile.stats.historyRTC, rollingWindow]);

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-6xl h-[95vh] rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                    <h2 className="text-3xl font-bold text-white">{profile.name} <span className="text-gray-500 text-lg">Statistics</span></h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-4xl leading-none">&times;</button>
                </div>
                {/* ... (Graafi ja stats koodi pysyy samana) ... */}
                {/* ... Laita tänne koko modaalin sisältö kuten aiemmin ... */}
                <div className="p-10 text-center text-gray-500">Stats content hidden for brevity (use previous code)</div>
            </div>
        </div>
    );
};


export default function Home() {
  const { profiles, createProfile, deleteProfile, updateManyProfiles, getAverage, exportStatsToCSV } = useProfiles();
  const [newProfileName, setNewProfileName] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<SavedProfile | null>(null);

  // UUSI: Botin asetukset
  const [botConfig, setBotConfig] = useState<{ count: number, skill: number }>({ count: 0, skill: 50 });

  const [settings, setSettings] = useState<GameSettings>({
    gameMode: 'x01',
    startScore: 501,
    doubleIn: false,
    doubleOut: true,
    playerCount: 2,
    matchMode: 'legs',
    targetToWin: 3,
    legsPerSet: 3,
    rtcIncludeBull: true,
  });

  const activeProfiles = selectedProfileIds
    .map(id => profiles.find(p => p.id === id))
    .filter((p): p is SavedProfile => p !== undefined);

  // KORJAUS: Välitetään botConfig hookille
  const game = useGameLogic(settings, activeProfiles, botConfig);

  if (gameStarted && (!game.currentPlayer || !game.players.length)) {
    setGameStarted(false); 
    return null;
  }

  const handleProfileSelect = (id: string) => {
    if (selectedProfileIds.includes(id)) {
      setSelectedProfileIds(prev => prev.filter(pid => pid !== id));
    } else {
      if (selectedProfileIds.length < 8) setSelectedProfileIds(prev => [...prev, id]);
    }
  };

  const saveAndExit = () => {
    const updates: { id: string, stats: Partial<SavedProfile['stats']> }[] = [];
    game.players.forEach(p => {
      // Vain ihmispelaajien statsit tallennetaan
      if (p.profileId && !p.isBot) {
        if (settings.gameMode === 'x01') {
            updates.push({
                id: p.profileId,
                stats: {
                    gamesPlayed: 1,
                    legsWon: p.legsWon,
                    setsWon: p.setsWon,
                    totalScore: p.stats.totalScore,
                    totalDarts: p.stats.totalDarts,
                    highestCheckout: p.stats.highestCheckout,
                    scores60plus: p.stats.scores60plus,
                    scores80plus: p.stats.scores80plus,
                    scores100plus: p.stats.scores100plus,
                    scores120plus: p.stats.scores120plus,
                    scores140plus: p.stats.scores140plus,
                    scores180: p.stats.scores180,
                    tonPlusFinishes: p.stats.tonPlusFinishes
                }
            });
        } else if (settings.gameMode === 'rtc') {
            updates.push({
                id: p.profileId,
                stats: {
                    rtcGamesPlayed: 1,
                    rtcTotalThrows: p.stats.rtcDartsThrown,
                    rtcTotalHits: p.stats.rtcTargetsHit,
                    rtcBestDarts: p.rtcFinished ? p.stats.rtcDartsThrown : undefined,
                    rtcSectorStats: p.stats.rtcSectorHistory
                }
            });
        }
      }
    });
    updateManyProfiles(updates);
    game.resetGame();
    setGameStarted(false);
    setSelectedProfileIds([]);
    setBotConfig({ count: 0, skill: 50 }); // Nollataan botit
  };

  // --- RENDER GAME UI (X01) ---
  const renderGameUI = () => {
      if (settings.gameMode === 'x01') {
          return (
            <div className="scale-90 lg:scale-100 relative">
                {/* Botin heittolukitus visuaalisesti */}
                {game.currentPlayer?.isBot && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-full">
                        {/* Ei tekstiä, vain estää klikkailun */}
                    </div>
                )}
                <Dartboard onThrow={game.handleDartThrow} currentUserId={game.currentPlayer?.id} />
            </div>
          );
      } else {
          // RTC UI
          const currentPlayer = game.currentPlayer;
          if (!currentPlayer) return null;

          if (currentPlayer.rtcFinished) {
              return (
                <div className="flex flex-col items-center justify-center w-full max-w-md">
                     <div className="bg-green-900/50 p-8 rounded-2xl border-4 border-green-500 mb-8 w-full text-center">
                        <div className="text-3xl font-bold text-white mb-2">FINISHED!</div>
                        <div className="text-gray-300 text-sm">Waiting for others...</div>
                        <div className="mt-4 text-xl font-mono">Darts: {currentPlayer.stats.rtcDartsThrown}</div>
                    </div>
                    {!currentPlayer.isBot && (
                        <button 
                            onClick={() => game.handleRTCAttempt(false)} 
                            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-xl border border-slate-500"
                        >
                            Skip Turn (Waiting)
                        </button>
                    )}
                </div>
              )
          }

          const currentTarget = currentPlayer.rtcTarget;
          const displayTarget = currentTarget === 21 ? 'BULL' : currentTarget;
          
          const hits = currentPlayer.stats.rtcTargetsHit || 0;
          const throws = currentPlayer.stats.rtcDartsThrown || 0;
          const percentage = throws > 0 ? ((hits / throws) * 100).toFixed(0) : 0;
          const dartsThrown = currentPlayer.stats.rtcDartsThrown || 0;

          const buttonsDisabled = game.isProcessing || (currentPlayer.currentVisit.length || 0) >= 3 || currentPlayer.isBot;

          return (
              <div className="flex flex-col items-center justify-center w-full max-w-md">
                  <div className="bg-slate-800 p-6 rounded-2xl border-4 border-blue-500 mb-6 w-full text-center relative shadow-lg">
                      <div className="text-gray-400 uppercase tracking-widest text-sm mb-1">Target</div>
                      <div className="text-8xl font-bold text-white font-mono">{displayTarget}</div>
                      
                      <div className="mt-4 flex justify-between items-center text-sm font-mono border-t border-slate-700 pt-3">
                          <div className="text-gray-300">Darts: <span className="text-white font-bold">{dartsThrown}</span></div>
                          <div className="text-gray-300">Hit%: <span className={`font-bold ${Number(percentage) > 50 ? 'text-green-400' : 'text-blue-400'}`}>{percentage}%</span></div>
                      </div>

                      <div className="absolute top-4 right-4 flex gap-1">
                          {[1,2,3].map(i => (
                              <div key={i} className={`w-2 h-2 rounded-full border border-slate-900 ${currentPlayer && currentPlayer.currentVisit.length >= i ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]' : 'bg-slate-700'}`}></div>
                          ))}
                      </div>
                  </div>
                  
                  {/* Jos botti, näytetään "Bot Throwing" teksti nappien sijaan tai disabloidut napit */}
                  {currentPlayer.isBot ? (
                      <div className="h-32 flex items-center justify-center text-blue-400 animate-pulse font-mono font-bold">
                          BOT THROWING...
                      </div>
                  ) : (
                    <div className="flex gap-4 w-full">
                        <button 
                            disabled={buttonsDisabled}
                            onClick={() => game.handleRTCAttempt(false)} 
                            className="flex-1 bg-red-900/40 hover:bg-red-900/60 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-600/50 text-red-200 h-32 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg"
                        >
                            <span className="text-6xl">✕</span>
                        </button>
                        <button 
                            disabled={buttonsDisabled}
                            onClick={() => game.handleRTCAttempt(true)} 
                            className="flex-1 bg-green-900/40 hover:bg-green-900/60 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-500/50 text-green-200 h-32 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg"
                        >
                            <span className="text-6xl">✓</span>
                        </button>
                    </div>
                  )}
              </div>
          );
      }
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex overflow-hidden">
      
      {viewingProfile && <ProfileStatsModal profile={viewingProfile} onClose={() => setViewingProfile(null)} />}

      {!gameStarted && (
        <div className="min-h-screen w-full overflow-auto bg-slate-900 p-4 flex flex-col items-center font-sans">
            <h1 className="text-4xl font-bold mb-8 text-orange-500 mt-8">DARTS PRO CENTER</h1>
            
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            
            {/* VASEN: PROFIILIT + BOTIT */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-green-400">1. Select Players</h2>
                    {profiles.length > 0 && (
                        <button onClick={exportStatsToCSV} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-blue-300">
                            Download CSV
                        </button>
                    )}
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4 pr-2">
                {profiles.map(p => (
                    <div key={p.id} className={`group p-3 rounded-lg flex justify-between items-center border transition-all ${selectedProfileIds.includes(p.id) ? 'bg-green-900/50 border-green-500' : 'bg-slate-700 border-transparent hover:bg-slate-600'}`}>
                        <div className="flex-1 cursor-pointer" onClick={() => handleProfileSelect(p.id)}>
                            <div className="font-bold">{p.name}</div>
                            <div className="text-xs text-gray-400">Avg: {getAverage(p)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setViewingProfile(p); }} className="bg-slate-600 hover:bg-blue-600 text-white p-2 rounded text-xs font-bold">STATS</button>
                            {selectedProfileIds.includes(p.id) && <span className="text-green-400 font-bold ml-2">✔</span>}
                            <button onClick={(e) => { e.stopPropagation(); deleteProfile(p.id); }} className="text-gray-500 hover:text-red-500 p-2">🗑️</button>
                        </div>
                    </div>
                ))}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                    <input type="text" placeholder="New Profile Name..." value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"/>
                    <button onClick={() => {createProfile(newProfileName); setNewProfileName("");}} className="bg-blue-600 px-4 py-2 rounded font-bold">Create</button>
                </div>

                {/* BOT SELECTOR */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-gray-300">Add Computer Opponent</h3>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setBotConfig(b => ({...b, count: Math.max(0, b.count - 1)}))} 
                                className="w-8 h-8 bg-slate-600 rounded hover:bg-slate-500"
                            >-</button>
                            <span className="font-mono font-bold w-4 text-center">{botConfig.count}</span>
                            <button 
                                onClick={() => setBotConfig(b => ({...b, count: Math.min(1, b.count + 1)}))} 
                                className="w-8 h-8 bg-slate-600 rounded hover:bg-slate-500"
                            >+</button>
                        </div>
                    </div>
                    {botConfig.count > 0 && (
                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Bot Skill Level: {botConfig.skill}</span>
                                <span>{botConfig.skill < 40 ? 'Beginner' : botConfig.skill < 70 ? 'Intermediate' : 'Pro'}</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" max="100" 
                                value={botConfig.skill} 
                                onChange={(e) => setBotConfig(b => ({...b, skill: parseInt(e.target.value)}))}
                                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* OIKEA: ASETUKSET (Sama kuin ennen) */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 opacity-90">
                {/* ... (Asetusvalikko pysyy samana, kopioi edellisestä koodista) ... */}
                {/* ... Lyhennän tätä vastausta varten, mutta tässä pitäisi olla kaikki asetuslogiikka ... */}
                <h2 className="text-xl font-bold mb-4 text-orange-400">2. Game Mode & Settings</h2>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    <button onClick={() => setSettings({...settings, gameMode: 'x01'})} className={`py-4 rounded-xl font-bold border-2 ${settings.gameMode === 'x01' ? 'bg-slate-700 border-green-500 text-white' : 'bg-slate-900 border-transparent text-gray-500'}`}>X01</button>
                    <button onClick={() => setSettings({...settings, gameMode: 'rtc'})} className={`py-4 rounded-xl font-bold border-2 ${settings.gameMode === 'rtc' ? 'bg-slate-700 border-blue-500 text-white' : 'bg-slate-900 border-transparent text-gray-500'}`}>Round the Clock</button>
                </div>
                
                {settings.gameMode === 'x01' && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            {[301, 501, 701].map(s => (
                                <button key={s} onClick={() => setSettings({...settings, startScore: s as any})} 
                                className={`flex-1 py-2 rounded font-bold ${settings.startScore === s ? 'bg-orange-500' : 'bg-slate-700'}`}>{s}</button>
                            ))}
                        </div>
                        <div className="flex bg-slate-700 rounded p-1">
                            <button onClick={() => setSettings({...settings, matchMode: 'legs'})} className={`flex-1 py-1 rounded ${settings.matchMode === 'legs' ? 'bg-slate-500 text-white' : 'text-gray-400'}`}>Legs</button>
                            <button onClick={() => setSettings({...settings, matchMode: 'sets'})} className={`flex-1 py-1 rounded ${settings.matchMode === 'sets' ? 'bg-slate-500 text-white' : 'text-gray-400'}`}>Sets</button>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded">
                            <span className="text-sm text-gray-300">To Win:</span>
                            <div className="font-mono text-xl font-bold text-white">{settings.targetToWin} {settings.matchMode}</div>
                            <div className="flex gap-1">
                                <button onClick={() => setSettings(s => ({...s, targetToWin: Math.max(1, s.targetToWin-1)}))} className="w-8 h-8 bg-slate-600 rounded text-white font-bold">-</button>
                                <button onClick={() => setSettings(s => ({...s, targetToWin: s.targetToWin+1}))} className="w-8 h-8 bg-slate-600 rounded text-white font-bold">+</button>
                            </div>
                        </div>
                        {settings.matchMode === 'sets' && (
                             <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded border border-slate-600">
                                <span className="text-sm text-green-400">Legs per Set:</span>
                                <div className="font-mono text-xl font-bold text-white">{settings.legsPerSet}</div>
                                <div className="flex gap-1">
                                    <button onClick={() => setSettings(s => ({...s, legsPerSet: Math.max(1, s.legsPerSet-1)}))} className="w-8 h-8 bg-slate-600 rounded text-white font-bold">-</button>
                                    <button onClick={() => setSettings(s => ({...s, legsPerSet: s.legsPerSet+1}))} className="w-8 h-8 bg-slate-600 rounded text-white font-bold">+</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {settings.gameMode === 'rtc' && (
                     <div className="space-y-4 border-t border-slate-700 pt-4">
                         <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded border border-blue-900/50">
                             <span className="text-gray-300">Include Bullseye (21)?</span>
                             <button onClick={() => setSettings({...settings, rtcIncludeBull: !settings.rtcIncludeBull})} className={`w-14 h-8 rounded-full transition-colors relative ${settings.rtcIncludeBull ? 'bg-green-500' : 'bg-slate-600'}`}>
                                 <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${settings.rtcIncludeBull ? 'left-7' : 'left-1'}`}></div>
                             </button>
                         </div>
                     </div>
                )}

                <button 
                    disabled={selectedProfileIds.length === 0 && botConfig.count === 0}
                    onClick={() => { 
                        setSettings({...settings, playerCount: selectedProfileIds.length + botConfig.count}); 
                        setGameStarted(true); 
                    }}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:text-gray-500 text-white font-bold py-4 rounded-xl text-xl mt-6 transition-all"
                >
                    START GAME
                </button>
            </div>
            </div>
        </div>
      )}

      {/* GAME SCREEN */}
      {gameStarted && (
         <>
         <div className="w-1/3 min-w-[350px] flex flex-col border-r border-slate-800 bg-slate-900">
             <div className="p-4 border-b border-slate-800">
                <h2 className="font-bold text-orange-500">{settings.gameMode === 'rtc' ? 'ROUND THE CLOCK' : 'GAME ON'}</h2>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {game.players.map(p => {
                     const isTurn = game.currentPlayer?.id === p.id;
                     return (
                         <div key={p.id} className={`rounded-xl p-4 border-l-4 ${isTurn ? 'bg-slate-800 border-green-500' : 'bg-slate-900/50 border-slate-700 opacity-60'}`}>
                             <div className="flex justify-between items-start">
                                 <div>
                                     <div className="font-bold text-lg">{p.name} {p.isBot && <span className="text-xs bg-slate-700 px-1 rounded ml-1">BOT</span>}</div>
                                     <div className="text-xs text-gray-400 mt-1">
                                         {settings.gameMode === 'rtc' ? `Darts: ${p.stats.rtcDartsThrown}` : 
                                            <span className="flex gap-2">
                                                <span>L: {p.legsWon}</span>
                                                {settings.matchMode === 'sets' && <span>S: {p.setsWon}</span>}
                                            </span>
                                         }
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     {settings.gameMode === 'rtc' ? (
                                         <div className="text-2xl font-mono font-bold text-blue-400">Target: {p.rtcTarget === 21 ? 'BULL' : p.rtcTarget}</div>
                                     ) : (
                                         <div className="text-4xl font-mono font-bold">{p.scoreLeft}</div>
                                     )}
                                 </div>
                             </div>
                         </div>
                     )
                 })}
             </div>
         </div>

         <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-900 relative">
             <div className="absolute top-4 right-4 flex gap-2">
                 <button 
                    onClick={game.undoLastThrow}
                    disabled={!game.canUndo}
                    className="bg-yellow-600/50 hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2 rounded text-yellow-100 font-bold border border-yellow-500"
                 >
                     UNDO
                 </button>
                 <button onClick={saveAndExit} className="bg-red-900/50 hover:bg-red-900 px-4 py-2 rounded text-red-200 font-bold border border-red-800">EXIT</button>
             </div>
             
             <div className="mb-4 text-center">
                 <h2 className="text-4xl font-bold mb-1">{game.currentPlayer?.name}</h2>
                 <p className="text-blue-500 text-sm uppercase tracking-widest">{settings.gameMode === 'rtc' ? 'Hit target?' : 'Throw Darts'}</p>
             </div>

             {renderGameUI()}

             {settings.gameMode === 'x01' && (
                 <div className="mt-8 w-full max-w-sm bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex justify-between h-16 items-center">
                     <span className="text-gray-400">Checkout:</span>
                     {(() => {
                        const score = game.currentPlayer?.scoreLeft || 0;
                        const dartsRemaining = 3 - (game.currentPlayer?.currentVisit.length || 0);
                        let possible = true;
                        if (dartsRemaining === 1 && score > 50) possible = false;
                        if (dartsRemaining === 2 && score > 110) possible = false;
                        if (dartsRemaining === 3 && score > 170) possible = false;
                        if (!possible) return <span className="text-gray-600 italic">No checkout</span>;
                        const guide = getCheckoutGuide(score);
                        return <span className="font-mono font-bold text-green-400 text-xl">{guide || "-"}</span>;
                     })()}
                 </div>
             )}
         </div>
         </>
      )}

      {/* GAME OVER MODAL */}
      {game.matchResult && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-2xl border-2 border-orange-500 max-w-4xl w-full">
                <h1 className="text-5xl font-bold text-center mb-8 text-white">GAME OVER</h1>
                <h2 className="text-2xl text-center mb-4 text-green-400">Winner: {game.matchResult.winner.name}</h2>
                <table className="w-full text-center border-collapse mb-8">
                    <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                            <th className="p-2 text-left">Stat</th>
                            {game.matchResult.players.map(p => <th key={p.id} className="p-2 text-white">{p.name}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {settings.gameMode === 'x01' ? (
                            [
                                { label: "Sets", key: "setsWon" },
                                { label: "Legs", key: "legsWon" },
                                { label: "Avg", key: "stats.average" },
                                { label: "High Checkout", key: "stats.highestCheckout" }
                            ].map(stat => (
                                <tr key={stat.label} className="border-b border-gray-700/50">
                                    <td className="p-2 text-left text-gray-400">{stat.label}</td>
                                    {game.matchResult?.players.map(p => {
                                        const val = stat.key.split('.').reduce((o: any, i: string) => o[i], p);
                                        return <td key={p.id} className="p-2 font-mono">{val}</td>
                                    })}
                                </tr>
                            ))
                        ) : (
                            [
                                { label: "Total Darts", key: "stats.rtcDartsThrown" },
                                { label: "Accuracy", calc: (p: any) => ((p.stats.rtcTargetsHit / p.stats.rtcDartsThrown * 100).toFixed(1) + '%') }
                            ].map((stat: any) => (
                                <tr key={stat.label} className="border-b border-gray-700/50">
                                    <td className="p-2 text-left text-gray-400">{stat.label}</td>
                                    {game.matchResult?.players.map(p => (
                                        <td key={p.id} className="p-2 font-mono">
                                            {stat.calc ? stat.calc(p) : stat.key.split('.').reduce((o: any, i: string) => o[i], p)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <button onClick={saveAndExit} className="w-full bg-slate-700 hover:bg-slate-600 py-4 rounded-xl font-bold">Back to Menu</button>
            </div>
        </div>
      )}
    </div>
  );
}