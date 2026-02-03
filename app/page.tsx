"use client";

import { useState } from "react";
import { useGameLogic, GameSettings } from "../hooks/useGame501";
import { useProfiles, SavedProfile } from "../hooks/useProfiles";
import { StatsModal } from "../components/StatsModal";
import { GameSetup } from "../components/GameSetup";
import { ActiveGame } from "../components/ActiveGame";
import { GameOverModal } from "../components/GameOverModal";

export default function Home() {
  const { profiles, createProfile, deleteProfile, updateManyProfiles, getAverage, exportStatsToCSV } = useProfiles();
  const [newProfileName, setNewProfileName] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<SavedProfile | null>(null);

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

  const [botConfig, setBotConfig] = useState({ count: 0, skill: 50 });

  const activeProfiles = selectedProfileIds
    .map(id => profiles.find(p => p.id === id))
    .filter((p): p is SavedProfile => p !== undefined);

  const game = useGameLogic(settings, activeProfiles.length > 0 ? activeProfiles : [], botConfig);

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
      if (p.profileId) {
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
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex overflow-hidden">
      {viewingProfile && <StatsModal profile={viewingProfile} onClose={() => setViewingProfile(null)} />}

      {!gameStarted ? (
        <GameSetup 
            profiles={profiles}
            settings={settings}
            setSettings={setSettings}
            selectedProfileIds={selectedProfileIds}
            handleProfileSelect={handleProfileSelect}
            createProfile={createProfile}
            deleteProfile={deleteProfile}
            newProfileName={newProfileName}
            setNewProfileName={setNewProfileName}
            onStartGame={() => { 
                setSettings({...settings, playerCount: selectedProfileIds.length}); 
                setGameStarted(true); 
            }}
            onViewStats={setViewingProfile}
            getAverage={getAverage}
            onExport={exportStatsToCSV}
            botConfig={botConfig}
            setBotConfig={setBotConfig}
        />
      ) : (
        <ActiveGame 
            settings={settings} 
            game={game} 
            onExit={saveAndExit} 
        />
      )}

      {game.matchResult && (
        <GameOverModal matchResult={game.matchResult} onSaveAndExit={saveAndExit} />
      )}
    </div>
  );
}