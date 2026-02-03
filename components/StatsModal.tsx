"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SavedProfile, HistoryEntry } from '../hooks/useProfiles';

// Apufunktio datan laskemiseen
const calculateRollingStats = (history: HistoryEntry[], windowSize: number) => {
    if (!history || history.length === 0) return [];

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

interface StatsModalProps {
    profile: SavedProfile;
    onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ profile, onClose }) => {
    const [tab, setTab] = useState<'x01' | 'rtc'>('x01');
    const [rollingWindow, setRollingWindow] = useState(10);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const x01GraphData = useMemo(() => {
        return calculateRollingStats(profile.stats.historyX01 || [], rollingWindow);
    }, [profile.stats.historyX01, rollingWindow]);

    const rtcGraphData = useMemo(() => {
        return calculateRollingStats(profile.stats.historyRTC || [], rollingWindow);
    }, [profile.stats.historyRTC, rollingWindow]);

    if (!isClient) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-6xl h-[95vh] rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                    <h2 className="text-3xl font-bold text-white">{profile.name} <span className="text-gray-500 text-lg">Statistics</span></h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-4xl leading-none">&times;</button>
                </div>

                <div className="flex border-b border-slate-700 bg-slate-800">
                    <button onClick={() => setTab('x01')} className={`flex-1 py-4 font-bold text-lg transition-colors ${tab === 'x01' ? 'bg-slate-700 text-green-400 border-b-2 border-green-400' : 'text-gray-400 hover:bg-slate-700/50'}`}>X01 & Progress</button>
                    <button onClick={() => setTab('rtc')} className={`flex-1 py-4 font-bold text-lg transition-colors ${tab === 'rtc' ? 'bg-slate-700 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:bg-slate-700/50'}`}>Training (RTC) & Progress</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
                    {tab === 'x01' ? (
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                <StatBox label="Games" value={profile.stats.gamesPlayed} />
                                <StatBox label="Lifetime Avg" value={((profile.stats.totalScore / (profile.stats.totalDarts || 1)) * 3).toFixed(2)} color="text-blue-400" />
                                <StatBox label="High Out" value={profile.stats.highestCheckout} color="text-orange-400" />
                                <StatBox label="180s" value={profile.stats.scores180} color="text-red-500" />
                                <StatBox label="100+ Checkouts" value={profile.stats.tonPlusFinishes} color="text-purple-400" />
                                <StatBox label="Total Darts" value={profile.stats.totalDarts} color="text-gray-300" />
                            </div>

                            <GraphSection 
                                title="Average Progression" 
                                data={x01GraphData} 
                                dataKey="rolling" 
                                window={rollingWindow} 
                                setWindow={setRollingWindow}
                                color="#4ade80"
                            />
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatBox label="RTC Games" value={profile.stats.rtcGamesPlayed || 0} />
                                <StatBox label="Best Darts" value={profile.stats.rtcBestDarts || '-'} color="text-green-400" />
                                <StatBox label="Total Accuracy" value={(profile.stats.rtcTotalThrows ? ((profile.stats.rtcTotalHits || 0) / profile.stats.rtcTotalThrows * 100).toFixed(1) : 0) + '%'} color="text-blue-400" />
                            </div>

                            <GraphSection 
                                title="Accuracy Progression (%)" 
                                data={rtcGraphData} 
                                dataKey="rolling" 
                                window={rollingWindow} 
                                setWindow={setRollingWindow}
                                color="#3b82f6"
                                domain={[0, 100]}
                            />

                            <h3 className="text-xl font-bold text-gray-300">Sector Accuracy</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                                {Array.from({length: 21}, (_, i) => i + 1).map(num => {
                                    const stats = profile.stats.rtcSectorStats?.[num.toString()];
                                    const attempts = stats?.attempts || 0;
                                    const hits = stats?.hits || 0;
                                    const pct = attempts > 0 ? Math.round((hits / attempts) * 100) : 0;
                                    let colorClass = "text-gray-500";
                                    let bgClass = "bg-slate-900";
                                    if (attempts > 0) {
                                        if (pct >= 50) { colorClass = "text-green-400"; bgClass="bg-green-900/20 border-green-800"; }
                                        else if (pct >= 30) { colorClass = "text-yellow-400"; bgClass="bg-yellow-900/20 border-yellow-800"; }
                                        else { colorClass = "text-red-400"; bgClass="bg-red-900/20 border-red-800"; }
                                    }
                                    return (
                                        <div key={num} className={`${bgClass} p-2 rounded border border-slate-700 flex flex-col items-center transition-colors`}>
                                            <span className="text-xs font-bold text-gray-400 mb-1">{num === 21 ? 'BULL' : num}</span>
                                            <span className={`text-xl font-bold ${colorClass}`}>{pct}%</span>
                                            <span className="text-[10px] text-gray-500">{hits}/{attempts}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatBox = ({ label, value, color = "text-white" }: { label: string, value: string | number, color?: string }) => (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
        <div className="text-gray-400 text-xs uppercase mb-1">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
);

const GraphSection = ({ title, data, dataKey, window, setWindow, color, domain }: any) => (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-inner">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-200">{title}</h3>
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Window:</span>
                <select 
                    value={window} 
                    onChange={(e) => setWindow(Number(e.target.value))}
                    className="bg-slate-900 text-white border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-green-500"
                >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                </select>
            </div>
        </div>
        
        {/* KORJAUS: style={{ width: '100%', height: 300 }} varmistaa että containerilla on koko */}
        <div style={{ width: '100%', height: 300 }}>
            {data.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                        <XAxis dataKey="gameIndex" stroke="#94a3b8" fontSize={12} label={{ value: 'Games', position: 'insideBottomRight', offset: -5, fill: '#64748b' }} />
                        <YAxis stroke="#94a3b8" domain={domain || ['auto', 'auto']} fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} labelFormatter={(label) => `Game #${label}`} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                        <Line name={`Rolling`} type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={false} activeDot={{r: 6}} />
                        <Line name="Cumulative" type="monotone" dataKey="cumulative" stroke="#facc15" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-500 bg-slate-900/50 rounded-lg border border-slate-700 border-dashed">
                    Not enough data yet.
                </div>
            )}
        </div>
    </div>
);