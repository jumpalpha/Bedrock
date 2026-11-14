"use client";

import { useCallback, useEffect, useState } from "react";
import { completeTask, dbReady, loadState, useStudent, type ServerState } from "@/lib/db";
import { computeStats } from "@/data/site";

/** The logged-in student's progress from the database, plus the derived XP, rank and badges. */
export function useProgress() {
  const { student, ready } = useStudent();
  const [state, setState] = useState<ServerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!student || !dbReady) { setState(null); return; }
    setLoading(true);
    try { setState(await loadState()); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [student]);

  useEffect(() => { refresh(); }, [refresh]);

  const check = async (key: string) => { await completeTask(key); await refresh(); };
  const stats = computeStats(state ?? { tasks: [], days: [] });
  return { student, ready, state, stats, error, loading, refresh, check, signedIn: !!student && !!state };
}
