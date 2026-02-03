import React from 'react';
import { PlayerState, MatchResult, GameMode } from '../hooks/useGame501';

interface GameOverModalProps {
    matchResult: MatchResult;
    onSaveAndExit: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ matchResult, onSaveAndExit }) => {
    if (!matchResult) return null;

    const { winner, players, mode } = matchResult;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-2xl border-2 border-orange-500 max-w-4xl w-full">
                <h1 className="text-5xl font-bold text-center mb-8 text-white">GAME OVER</h1>
                <h2 className="text-2xl text-center mb-4 text-green-400">Winner: {winner.name}</h2>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse mb-8">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="p-2 text-left">Stat</th>
                                {players.map(p => <th key={p.id} className="p-2 text-white">{p.name}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {mode === 'x01' ? (
                                [
                                    { label: "Sets", key: "setsWon" },
                                    { label: "Legs", key: "legsWon" },
                                    { label: "Avg", key: "stats.average" },
                                    { label: "High Checkout", key: "stats.highestCheckout" }
                                ].map((stat: any) => (
                                    <tr key={stat.label} className="border-b border-gray-700/50">
                                        <td className="p-2 text-left text-gray-400">{stat.label}</td>
                                        {players.map(p => {
                                            const val = stat.key.split('.').reduce((o: any, i: string) => o[i], p);
                                            return <td key={p.id} className="p-2 font-mono">{val}</td>
                                        })}
                                    </tr>
                                ))
                            ) : (
                                [
                                    { label: "Total Darts", key: "stats.rtcDartsThrown" },
                                    { label: "Accuracy", calc: (p: PlayerState) => ((p.stats.rtcTargetsHit / p.stats.rtcDartsThrown * 100).toFixed(1) + '%') }
                                ].map((stat: any) => (
                                    <tr key={stat.label} className="border-b border-gray-700/50">
                                        <td className="p-2 text-left text-gray-400">{stat.label}</td>
                                        {players.map(p => (
                                            <td key={p.id} className="p-2 font-mono">
                                                {stat.calc ? stat.calc(p) : stat.key.split('.').reduce((o: any, i: string) => o[i], p)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <button onClick={onSaveAndExit} className="w-full bg-slate-700 hover:bg-slate-600 py-4 rounded-xl font-bold text-white">Back to Menu</button>
            </div>
        </div>
    );
};