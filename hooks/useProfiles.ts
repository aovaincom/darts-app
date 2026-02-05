"use client";

import { useState, useEffect } from 'react';

export type HistoryEntry = {
    value?: number;
    gameValue?: number;
    cumulativeValue?: number;
    date: string;
};

// PÄIVITETTY TYYPPIMÄÄRITELMÄ
export type SavedProfile = {
  id: string;
  name: string;
  stats: {
    // X01
    gamesPlayed: number;
    legsWon: number;
    setsWon: number;
    totalScore: number;
    totalDarts: number;
    highestCheckout: number;
    
    // Scoring
    scores60plus: number;
    scores80plus: number;
    scores100plus: number;
    scores120plus: number;
    scores140plus: number;
    scores180: number;
    tonPlusFinishes: number;

    // Advanced X01 Stats (UUDET)
    first9Sum: number;      // Summa 9 ensimmäisestä tikasta per legi
    first9Darts: number;    // Kuinka monta tikkaa heitetty "first 9" vaiheessa
    legsWonDarts: {         // Tilasto: kuinka monella tikalla legi voitettiin
        9: number;
        12: number; // 10-12
        15: number; // 13-15
        18: number; // 16-18
        21: number; // 19-21
        29: number; // 22-29
        30: number; // 30+
    };
    
    // RTC
    rtcGamesPlayed: number;
    rtcBestDarts?: number;
    rtcTotalThrows?: number;
    rtcTotalHits?: number;
    rtcSectorHistory?: Record<string, { attempts: number; hits: number }>;

    // Historia
    historyX01?: HistoryEntry[];
    historyRTC?: HistoryEntry[];
  };
};

export const useProfiles = () => {
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('darts_profiles');
    if (saved) {
      try {
        setProfiles(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load profiles", e);
      }
    }
  }, []);

  const saveToStorage = (updated: SavedProfile[]) => {
    setProfiles(updated);
    localStorage.setItem('darts_profiles', JSON.stringify(updated));
  };

  const createProfile = (name: string) => {
    if (!name.trim()) return;
    const newProfile: SavedProfile = {
      id: Date.now().toString(),
      name,
      stats: {
        gamesPlayed: 0, legsWon: 0, setsWon: 0,
        totalScore: 0, totalDarts: 0, highestCheckout: 0,
        scores60plus: 0, scores80plus: 0, scores100plus: 0, scores120plus: 0, scores140plus: 0, scores180: 0, tonPlusFinishes: 0,
        first9Sum: 0, first9Darts: 0,
        legsWonDarts: { 9: 0, 12: 0, 15: 0, 18: 0, 21: 0, 29: 0, 30: 0 },
        rtcGamesPlayed: 0
      }
    };
    saveToStorage([...profiles, newProfile]);
  };

  const deleteProfile = (id: string) => {
    if (confirm("Are you sure you want to delete this profile?")) {
        saveToStorage(profiles.filter(p => p.id !== id));
    }
  };

  const updateManyProfiles = (updates: { id: string, stats: Partial<SavedProfile['stats']> }[]) => {
    const updatedProfiles = profiles.map(p => {
      const update = updates.find(u => u.id === p.id);
      if (update) {
        const newStats = { ...p.stats, ...update.stats };
        
        // Summaa numeeriset arvot
        const numericKeys = [
            'gamesPlayed', 'legsWon', 'setsWon', 'totalScore', 'totalDarts', 
            'scores60plus', 'scores80plus', 'scores100plus', 'scores120plus', 'scores140plus', 'scores180', 'tonPlusFinishes',
            'first9Sum', 'first9Darts',
            'rtcGamesPlayed', 'rtcTotalThrows', 'rtcTotalHits'
        ] as const;

        numericKeys.forEach(key => {
            if (update.stats[key] !== undefined) {
                // @ts-ignore
                newStats[key] = (p.stats[key] || 0) + (update.stats[key] || 0);
            }
        });

        // Max/Min arvot
        if (update.stats.highestCheckout) {
            newStats.highestCheckout = Math.max(p.stats.highestCheckout || 0, update.stats.highestCheckout);
        }
        if (update.stats.rtcBestDarts) {
            const currentBest = p.stats.rtcBestDarts || 9999;
            newStats.rtcBestDarts = Math.min(currentBest, update.stats.rtcBestDarts);
        }

        // Merge objektit (Sektorit ja LegsWonDarts)
        if (update.stats.rtcSectorHistory) {
            const oldSec = p.stats.rtcSectorHistory || {};
            const newSec = update.stats.rtcSectorHistory;
            const mergedSec: any = { ...oldSec };
            Object.keys(newSec).forEach(key => {
                if (!mergedSec[key]) mergedSec[key] = { attempts: 0, hits: 0 };
                mergedSec[key].attempts += newSec[key].attempts;
                mergedSec[key].hits += newSec[key].hits;
            });
            newStats.rtcSectorHistory = mergedSec;
        }

        if (update.stats.legsWonDarts) {
            const oldL = p.stats.legsWonDarts || { 9: 0, 12: 0, 15: 0, 18: 0, 21: 0, 29: 0, 30: 0 };
            const newL = update.stats.legsWonDarts;
            const mergedL: any = { ...oldL };
            Object.keys(newL).forEach(key => {
                // @ts-ignore
                mergedL[key] = (mergedL[key] || 0) + (newL[key] || 0);
            });
            newStats.legsWonDarts = mergedL;
        }

        // Historia
        if (update.stats.totalScore && update.stats.totalDarts) {
            const gameAvg = (update.stats.totalScore / update.stats.totalDarts) * 3;
            const newTotalScore = (p.stats.totalScore || 0) + update.stats.totalScore;
            const newTotalDarts = (p.stats.totalDarts || 0) + update.stats.totalDarts;
            const cumAvg = (newTotalScore / newTotalDarts) * 3;

            const entry: HistoryEntry = {
                gameValue: parseFloat(gameAvg.toFixed(2)),
                cumulativeValue: parseFloat(cumAvg.toFixed(2)),
                date: new Date().toISOString()
            };
            newStats.historyX01 = [...(p.stats.historyX01 || []), entry];
        }

        if (update.stats.rtcTotalThrows && update.stats.rtcTotalHits !== undefined) {
            const gamePct = (update.stats.rtcTotalHits / update.stats.rtcTotalThrows) * 100;
            const newThrows = (p.stats.rtcTotalThrows || 0) + update.stats.rtcTotalThrows;
            const newHits = (p.stats.rtcTotalHits || 0) + update.stats.rtcTotalHits;
            const cumPct = newThrows > 0 ? (newHits / newThrows) * 100 : 0;

            const entry: HistoryEntry = {
                gameValue: parseFloat(gamePct.toFixed(1)),
                cumulativeValue: parseFloat(cumPct.toFixed(1)),
                date: new Date().toISOString()
            };
            newStats.historyRTC = [...(p.stats.historyRTC || []), entry];
        }

        return { ...p, stats: newStats };
      }
      return p;
    });
    saveToStorage(updatedProfiles);
  };

  const getAverage = (p: SavedProfile) => {
    if (!p.stats.totalDarts) return "0.0";
    return ((p.stats.totalScore / p.stats.totalDarts) * 3).toFixed(1);
  };

  const exportStatsToCSV = () => {
      // Yksinkertaistettu CSV export (voi laajentaa myöhemmin)
      const headers = ["Name", "Games", "Avg", "HighOut"];
      const rows = profiles.map(p => [p.name, p.stats.gamesPlayed, getAverage(p), p.stats.highestCheckout]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "darts_stats.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return { profiles, createProfile, deleteProfile, updateManyProfiles, getAverage, exportStatsToCSV };
};