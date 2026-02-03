import React from 'react';
import { Dartboard } from './Dartboard';
import { PlayerState, GameSettings } from '../hooks/useGame501';
import { getCheckoutGuide } from '../utils/checkouts';

interface ActiveGameProps {
    settings: GameSettings;
    game: any; // Käytetään 'any' tai importataan useGameLogic return type jos halutaan tiukka tyypitys
    onExit: () => void;
}

export const ActiveGame: React.FC<ActiveGameProps> = ({ settings, game, onExit }) => {
    const { players, currentPlayer, handleDartThrow, handleRTCAttempt, undoLastThrow, canUndo, isProcessing } = game;

    const renderGameUI = () => {
        if (settings.gameMode === 'x01') {
            return (
              <div className="scale-90 lg:scale-100">
                  <Dartboard onThrow={handleDartThrow} currentUserId={currentPlayer?.id} />
              </div>
            );
        } else {
            // RTC UI
            if (currentPlayer?.rtcFinished) {
                return (
                  <div className="flex flex-col items-center justify-center w-full max-w-md">
                       <div className="bg-green-900/50 p-8 rounded-2xl border-4 border-green-500 mb-8 w-full text-center">
                          <div className="text-3xl font-bold text-white mb-2">FINISHED!</div>
                          <div className="text-gray-300 text-sm">Waiting for others...</div>
                          <div className="mt-4 text-xl font-mono">Darts: {currentPlayer.stats.rtcDartsThrown}</div>
                      </div>
                      <button 
                          onClick={() => handleRTCAttempt(false)} 
                          className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-xl border border-slate-500"
                      >
                          Skip Turn (Waiting)
                      </button>
                  </div>
                )
            }
  
            const currentTarget = currentPlayer?.rtcTarget;
            const displayTarget = currentTarget === 21 ? 'BULL' : currentTarget;
            const hits = currentPlayer?.stats.rtcTargetsHit || 0;
            const throws = currentPlayer?.stats.rtcDartsThrown || 0;
            const percentage = throws > 0 ? ((hits / throws) * 100).toFixed(0) : 0;
            const dartsThrown = currentPlayer?.stats.rtcDartsThrown || 0;
            const buttonsDisabled = isProcessing || (currentPlayer?.currentVisit.length || 0) >= 3 || currentPlayer?.isBot;
  
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
                    
                    <div className="flex gap-4 w-full">
                        <button disabled={buttonsDisabled} onClick={() => handleRTCAttempt(false)} className="flex-1 bg-red-900/40 hover:bg-red-900/60 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-600/50 text-red-200 h-32 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg"><span className="text-6xl">✕</span></button>
                        <button disabled={buttonsDisabled} onClick={() => handleRTCAttempt(true)} className="flex-1 bg-green-900/40 hover:bg-green-900/60 disabled:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-500/50 text-green-200 h-32 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg"><span className="text-6xl">✓</span></button>
                    </div>
                </div>
            );
        }
    };

    return (
        <>
         <div className="w-1/3 min-w-[350px] flex flex-col border-r border-slate-800 bg-slate-900">
             <div className="p-4 border-b border-slate-800">
                <h2 className="font-bold text-orange-500">{settings.gameMode === 'rtc' ? 'ROUND THE CLOCK' : 'GAME ON'}</h2>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {players.map((p: PlayerState) => {
                     const isTurn = currentPlayer?.id === p.id;
                     return (
                         <div key={p.id} className={`rounded-xl p-4 border-l-4 ${isTurn ? 'bg-slate-800 border-green-500' : 'bg-slate-900/50 border-slate-700 opacity-60'}`}>
                             <div className="flex justify-between items-start">
                                 <div>
                                     <div className="font-bold text-lg">{p.name} {p.isBot && <span className="text-xs text-blue-400 border border-blue-500 px-1 rounded ml-1">BOT</span>}</div>
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
                    onClick={undoLastThrow}
                    disabled={!canUndo}
                    className="bg-yellow-600/50 hover:bg-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2 rounded text-yellow-100 font-bold border border-yellow-500"
                 >
                     UNDO
                 </button>
                 <button onClick={onExit} className="bg-red-900/50 hover:bg-red-900 px-4 py-2 rounded text-red-200 font-bold border border-red-800">EXIT</button>
             </div>
             
             <div className="mb-4 text-center">
                 <h2 className="text-4xl font-bold mb-1">{currentPlayer?.name}</h2>
                 <p className="text-blue-500 text-sm uppercase tracking-widest">{settings.gameMode === 'rtc' ? 'Hit target?' : 'Throw Darts'}</p>
             </div>

             {renderGameUI()}

             {settings.gameMode === 'x01' && (
                 <div className="mt-8 w-full max-w-sm bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex justify-between h-16 items-center">
                     <span className="text-gray-400">Checkout:</span>
                     
                     {(() => {
                        const score = currentPlayer?.scoreLeft || 0;
                        const dartsRemaining = 3 - (currentPlayer?.currentVisit.length || 0);
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
    );
}