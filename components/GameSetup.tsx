// Force update
import React from 'react';
import { SavedProfile } from '../hooks/useProfiles';
import { GameSettings } from '../hooks/useGame501';

interface GameSetupProps {
    profiles: SavedProfile[];
    settings: GameSettings;
    setSettings: (s: GameSettings | ((prev: GameSettings) => GameSettings)) => void;
    selectedProfileIds: string[];
    handleProfileSelect: (id: string) => void;
    createProfile: (name: string) => void;
    deleteProfile: (id: string) => void;
    newProfileName: string;
    setNewProfileName: (s: string) => void;
    onStartGame: () => void;
    onViewStats: (p: SavedProfile) => void;
    getAverage: (p: SavedProfile) => string;
    onExport: () => void;
    botConfig: { count: number, skill: number };
    setBotConfig: (c: any) => void;
}

export const GameSetup: React.FC<GameSetupProps> = ({ 
    profiles, settings, setSettings, selectedProfileIds, handleProfileSelect, 
    createProfile, deleteProfile, newProfileName, setNewProfileName, onStartGame, 
    onViewStats, getAverage, onExport, botConfig, setBotConfig 
}) => {
    return (
        <div className="min-h-screen w-full overflow-auto bg-slate-900 p-4 flex flex-col items-center font-sans">
            <h1 className="text-4xl font-bold mb-8 text-orange-500 mt-8">DARTS PRO CENTER</h1>
            
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            
            {/* 1. SELECT PLAYERS */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-green-400">1. Select Players</h2>
                    {profiles.length > 0 && (
                        <button onClick={onExport} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-blue-300">
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
                            <button onClick={(e) => { e.stopPropagation(); onViewStats(p); }} className="bg-slate-600 hover:bg-blue-600 text-white p-2 rounded text-xs font-bold">STATS</button>
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
            </div>

            {/* 2. GAME SETTINGS */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 opacity-90">
                <h2 className="text-xl font-bold mb-4 text-orange-400">2. Game Mode & Settings</h2>
                
                <div className="grid grid-cols-2 gap-2 mb-6">
                    <button onClick={() => setSettings({...settings, gameMode: 'x01'})} className={`py-4 rounded-xl font-bold border-2 ${settings.gameMode === 'x01' ? 'bg-slate-700 border-green-500 text-white' : 'bg-slate-900 border-transparent text-gray-500'}`}>X01</button>
                    <button onClick={() => setSettings({...settings, gameMode: 'rtc'})} className={`py-4 rounded-xl font-bold border-2 ${settings.gameMode === 'rtc' ? 'bg-slate-700 border-blue-500 text-white' : 'bg-slate-900 border-transparent text-gray-500'}`}>Round the Clock</button>
                </div>

                {/* BOT SETTINGS */}
                <div className="mb-6 border border-slate-700 bg-slate-900/50 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-gray-300 font-bold">Add Dartbot?</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setBotConfig((prev: any) => ({...prev, count: Math.max(0, prev.count - 1)}))} className="w-8 h-8 bg-slate-700 rounded text-white font-bold">-</button>
                            <span className="text-white w-4 text-center">{botConfig.count}</span>
                            <button onClick={() => setBotConfig((prev: any) => ({...prev, count: Math.min(1, prev.count + 1)}))} className="w-8 h-8 bg-slate-700 rounded text-white font-bold">+</button>
                        </div>
                    </div>
                    
                    {botConfig.count > 0 && (
                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Skill Level (Avg)</span>
                                <span>{botConfig.skill}</span>
                            </div>
                            <input type="range" min="20" max="100" step="5" value={botConfig.skill} onChange={(e) => setBotConfig((prev: any) => ({...prev, skill: Number(e.target.value)}))} className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                            <div className="flex justify-between text-[10px] text-gray-500 mt-1"><span>Beginner (20)</span><span>Pro (100)</span></div>
                        </div>
                    )}
                </div>

                {settings.gameMode === 'x01' && (
                    <div className="space-y-4 border-t border-slate-700 pt-4">
                        <div className="flex gap-2">
                            {[301, 501, 701].map(s => (
                                <button key={s} onClick={() => setSettings({...settings, startScore: s as any})} className={`flex-1 py-2 rounded font-bold ${settings.startScore === s ? 'bg-orange-500' : 'bg-slate-700'}`}>{s}</button>
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
                         <div className="text-center text-sm text-blue-200">Hit numbers 1-20 {settings.rtcIncludeBull && 'and Bull'} in order.</div>
                     </div>
                )}

                <button disabled={selectedProfileIds.length === 0} onClick={onStartGame} className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:text-gray-500 text-white font-bold py-4 rounded-xl text-xl mt-6 transition-all">START GAME</button>
            </div>
            </div>
        </div>
    );
};