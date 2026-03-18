import { useState, useCallback } from "react";

const KEY   = "ff_daily_stats";
const GOAL  = 50;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-03-17"
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { date: todayKey(), contacted: 0, opened: 0 };
    const data = JSON.parse(raw);
    // Reset if stored date is not today
    if (data.date !== todayKey()) {
      return { date: todayKey(), contacted: 0, opened: 0 };
    }
    return data;
  } catch {
    return { date: todayKey(), contacted: 0, opened: 0 };
  }
}

function persist(stats) {
  localStorage.setItem(KEY, JSON.stringify(stats));
}

export function useDailyStats() {
  const [stats, setStats] = useState(load);

  const increment = useCallback((field = "contacted") => {
    setStats((prev) => {
      const next = { ...prev, [field]: (prev[field] || 0) + 1 };
      persist(next);
      return next;
    });
  }, []);

  const decrement = useCallback((field = "contacted") => {
    setStats((prev) => {
      const next = { ...prev, [field]: Math.max(0, (prev[field] || 0) - 1) };
      persist(next);
      return next;
    });
  }, []);

  return { stats, goal: GOAL, increment, decrement };
}
