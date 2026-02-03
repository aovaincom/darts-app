import { useState, useEffect } from 'react';

// Päivitetty historiarakenne (mukana value? taaksepäin yhteensopivuudelle)
export type HistoryEntry = {
  date: number; 
  gameValue: number;       
  cumulativeValue: number; 
  value?: number; // <--- KORJAUS: Tämä poistaa TS-virheen (legacy support)
};

export type SavedProfile = {
  id: string;
  name: string;
  stats: {
    // X01 Stats
    gamesPlayed: number;
    legsWon: number;
    setsWon: number;
    totalScore: number;
    totalDarts: number;
    highestCheckout: number;
    
    // Scoring Milestones
    scores60plus: number;
    scores80plus: number;
    scores100plus: number;
    scores120plus: number;
    scores140plus: number;
    scores180: number;
    tonPlusFinishes: number;

    // RTC Stats
    rtcGamesPlayed?: number;
    rtcBestDarts?: number;
    rtcTotalHits?: number;
    rtcTotalThrows?: number;
    rtcSectorStats?: Record<string, { attempts: number; hits: number }>;

    // History
    historyX01?: HistoryEntry[];
    historyRTC?: HistoryEntry[];
  };
};

export const useProfiles = () => {
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('darts_profiles');
    if (saved) {
      const parsed = JSON.parse(saved).map((p: any) => ({
        ...p,
        stats: {
          ...p.stats,
          scores80plus: p.stats.scores80plus || 0,
          scores120plus: p.stats.scores120plus || 0,
          tonPlusFinishes: p.stats.tonPlusFinishes || 0,
          historyX01: p.stats.historyX01 || [],
          historyRTC: p.stats.historyRTC || []
        }
      }));
      setProfiles(parsed);
    }
  }, []);

  const saveToStorage = (updatedProfiles: SavedProfile[]) => {
    localStorage.setItem('darts_profiles', JSON.stringify(updatedProfiles));
    setProfiles(updatedProfiles);
  };

  const createProfile = (name: string) => {
    if (!name.trim()) return;
    const newProfile: SavedProfile = {
      id: Date.now().toString(),
      name,
      stats: {
        gamesPlayed: 0,
        legsWon: 0,
        setsWon: 0,
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
        rtcGamesPlayed: 0,
        rtcBestDarts: 0, 
        rtcTotalHits: 0,
        rtcTotalThrows: 0,
        rtcSectorStats: {},
        historyX01: [],
        historyRTC: []
      }
    };
    saveToStorage([...profiles, newProfile]);
  };

  const deleteProfile = (id: string) => {
    if (window.confirm("Are you sure you want to delete this profile?")) {
      const updated = profiles.filter(p => p.id !== id);
      saveToStorage(updated);
    }
  };

  const updateManyProfiles = (updates: { id: string, stats: Partial<SavedProfile['stats']> }[]) => {
    const updatedProfiles = profiles.map(p => {
      const update = updates.find(u => u.id === p.id);
      if (!update) return p;

      const newStats = update.stats;
      const currentStats = p.stats;
      const timestamp = Date.now();

      // --- HISTORIAN PÄIVITYS (X01) ---
      const newHistoryX01 = [...(currentStats.historyX01 || [])];
      if (newStats.totalScore && newStats.totalDarts) {
          const gameAvg = parseFloat(((newStats.totalScore / newStats.totalDarts) * 3).toFixed(2));
          const totalS = currentStats.totalScore + newStats.totalScore;
          const totalD = currentStats.totalDarts + newStats.totalDarts;
          const cumulativeAvg = parseFloat(((totalS / totalD) * 3).toFixed(2));

          newHistoryX01.push({ 
              date: timestamp, 
              gameValue: gameAvg, 
              cumulativeValue: cumulativeAvg 
          });
      }

      // --- HISTORIAN PÄIVITYS (RTC) ---
      const newHistoryRTC = [...(currentStats.historyRTC || [])];
      if (newStats.rtcTotalHits !== undefined && newStats.rtcTotalThrows) {
          const gameAcc = parseFloat(((newStats.rtcTotalHits / newStats.rtcTotalThrows) * 100).toFixed(1));
          const totalH = (currentStats.rtcTotalHits || 0) + newStats.rtcTotalHits;
          const totalT = (currentStats.rtcTotalThrows || 0) + newStats.rtcTotalThrows;
          const cumulativeAcc = parseFloat(((totalH / totalT) * 100).toFixed(1));

          newHistoryRTC.push({ 
              date: timestamp, 
              gameValue: gameAcc, 
              cumulativeValue: cumulativeAcc 
          });
      }

      // Sektorit
      const currentSectorStats = currentStats.rtcSectorStats || {};
      const newSectorStats = newStats.rtcSectorStats || {};
      const mergedSectorStats = { ...currentSectorStats };
      Object.keys(newSectorStats).forEach(key => {
          const existing = mergedSectorStats[key] || { attempts: 0, hits: 0 };
          const incoming = newSectorStats[key];
          mergedSectorStats[key] = {
              attempts: existing.attempts + incoming.attempts,
              hits: existing.hits + incoming.hits
          };
      });

      let newRtcBest = currentStats.rtcBestDarts || 0;
      if (newStats.rtcBestDarts) {
          if (newRtcBest === 0 || newStats.rtcBestDarts < newRtcBest) {
              newRtcBest = newStats.rtcBestDarts;
          }
      }

      return {
        ...p,
        stats: {
          ...currentStats,
          gamesPlayed: currentStats.gamesPlayed + (newStats.gamesPlayed || 0),
          legsWon: currentStats.legsWon + (newStats.legsWon || 0),
          setsWon: currentStats.setsWon + (newStats.setsWon || 0),
          totalScore: currentStats.totalScore + (newStats.totalScore || 0),
          totalDarts: currentStats.totalDarts + (newStats.totalDarts || 0),
          highestCheckout: Math.max(currentStats.highestCheckout, newStats.highestCheckout || 0),
          scores60plus: currentStats.scores60plus + (newStats.scores60plus || 0),
          scores80plus: currentStats.scores80plus + (newStats.scores80plus || 0),
          scores100plus: currentStats.scores100plus + (newStats.scores100plus || 0),
          scores120plus: currentStats.scores120plus + (newStats.scores120plus || 0),
          scores140plus: currentStats.scores140plus + (newStats.scores140plus || 0),
          scores180: currentStats.scores180 + (newStats.scores180 || 0),
          tonPlusFinishes: currentStats.tonPlusFinishes + (newStats.tonPlusFinishes || 0),
          rtcGamesPlayed: (currentStats.rtcGamesPlayed || 0) + (newStats.rtcGamesPlayed || 0),
          rtcTotalHits: (currentStats.rtcTotalHits || 0) + (newStats.rtcTotalHits || 0),
          rtcTotalThrows: (currentStats.rtcTotalThrows || 0) + (newStats.rtcTotalThrows || 0),
          rtcBestDarts: newRtcBest,
          rtcSectorStats: mergedSectorStats,
          historyX01: newHistoryX01,
          historyRTC: newHistoryRTC
        }
      };
    });
    saveToStorage(updatedProfiles);
  };

  // CSV Export
  const exportStatsToCSV = () => {
    if (profiles.length === 0) {
        alert("No profiles to export.");
        return;
    }
    const headers = [
        "Name", "Games Played", "Legs Won", "Total Score", "Total Darts", 
        "Avg (3-dart)", "Highest Checkout", "Ton+ Finishes", "180s",
        "RTC Games", "RTC Best", "RTC Accuracy %"
    ];
    const rows = profiles.map(p => {
        const s = p.stats;
        const avg = s.totalDarts > 0 ? ((s.totalScore / s.totalDarts) * 3).toFixed(2) : "0.00";
        const rtcAcc = s.rtcTotalThrows ? ((s.rtcTotalHits || 0) / s.rtcTotalThrows * 100).toFixed(2) : "0.00";
        return [
            `"${p.name}"`, s.gamesPlayed, s.legsWon, s.totalScore, s.totalDarts,
            avg, s.highestCheckout, s.tonPlusFinishes || 0, s.scores180,
            s.rtcGamesPlayed || 0, s.rtcBestDarts || 0, rtcAcc
        ].join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "darts_stats.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAverage = (p: SavedProfile) => {
    if (!p.stats.totalDarts || p.stats.totalDarts === 0) return "0.00";
    return ((p.stats.totalScore / p.stats.totalDarts) * 3).toFixed(2);
  };

  const getRtcHitPercentage = (p: SavedProfile) => {
      const throws = p.stats.rtcTotalThrows || 0;
      const hits = p.stats.rtcTotalHits || 0;
      if (throws === 0) return "0%";
      return ((hits / throws) * 100).toFixed(1) + "%";
  };

  return { profiles, createProfile, deleteProfile, updateManyProfiles, getAverage, getRtcHitPercentage, exportStatsToCSV };
};