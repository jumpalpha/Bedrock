"use client";
// ── wave-twinA ── Save/load for the Be Ready projects (Dopps Class student-save.js):
// logged in → the class database (b_project_get / b_project_save); logged out → this browser only.
import { useCallback, useEffect, useRef, useState } from "react";
import { dbReady, projectGet, projectSave, useStudent, type ProjectKey, type ProjectRow } from "@/lib/db";

const localKey = (key: ProjectKey) => `bedrock_proj_${key}`;
type Local = { data: Record<string, unknown>; done: boolean };

export function readLocal(key: ProjectKey): Local | null {
  try {
    const o = JSON.parse(localStorage.getItem(localKey(key)) || "null");
    return o && typeof o === "object" && o.data && typeof o.data === "object" ? { data: o.data, done: !!o.done } : null;
  } catch { return null; }
}
function writeLocal(key: ProjectKey, data: Record<string, unknown>, done: boolean) {
  try {
    const prev = readLocal(key);
    localStorage.setItem(localKey(key), JSON.stringify({ data, done: done || !!prev?.done, at: new Date().toISOString() }));
  } catch {}
}

/** data = the saved object; save(next, done?) stores it (debounced to the database when logged in). */
export function useProjectSave<T extends Record<string, unknown>>(key: ProjectKey, initial: T) {
  const { student, ready } = useStudent();
  const [data, setData] = useState<T>(initial);
  const [row, setRow] = useState<ProjectRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloud = !!student && dbReady;

  useEffect(() => {
    if (!ready) return;
    const local = readLocal(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount (static export)
    if (local) setData((d) => ({ ...d, ...(local.data as T) }));
    if (!cloud) { setLoaded(true); return; }
    projectGet(key)
      .then((r) => { setRow(r); if (r?.data) setData((d) => ({ ...d, ...(r.data as T) })); setError(null); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoaded(true));
  }, [ready, cloud, key]);

  const save = useCallback(async (next: T, done = false): Promise<"cloud" | "local"> => {
    setData(next);
    writeLocal(key, next, done);
    if (!cloud) return "local";
    if (timer.current) clearTimeout(timer.current);
    if (done) {
      try { const r = await projectSave(key, next, true); setRow(r); setError(null); return "cloud"; }
      catch (e) { setError((e as Error).message); return "local"; }
    }
    timer.current = setTimeout(() => {
      projectSave(key, next, false).then((r) => { setRow(r); setError(null); }).catch((e) => setError((e as Error).message));
    }, 400);
    return "cloud";
  }, [cloud, key]);

  return { data, save, row, loaded, cloud, error, localDone: () => !!readLocal(key)?.done };
}
