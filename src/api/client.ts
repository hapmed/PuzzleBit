/** Cliente de la API del backend (FastAPI). Network-first con cola offline. */

import { drainPending, enqueuePending, getNickname, pendingCount, setNickname } from "../game/state";

const API_BASE: string = (import.meta.env?.VITE_API_URL as string | undefined) ?? "/api";

export interface RankingEntry {
  player: string;
  score: number;
}

export interface LevelRanking {
  total: RankingEntry[];
  perLevel: Record<string, RankingEntry[]>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function flushPending(): Promise<number> {
  const pending = drainPending();
  let sent = 0;
  for (const op of pending) {
    try {
      if (op.kind === "progress") {
        await request<unknown>("/progress", { method: "POST", body: JSON.stringify(op.payload) });
      } else {
        await request<unknown>("/scores", { method: "POST", body: JSON.stringify(op.payload) });
      }
      sent++;
    } catch {
      enqueuePending(op);
    }
  }
  return sent;
}

export function pendingSyncCount(): number {
  return pendingCount();
}

export interface PostScorePayload {
  player: string;
  level_id: number;
  score: number;
  moves_left: number;
}

export async function postScore(payload: Omit<PostScorePayload, "player"> & { player?: string }): Promise<boolean> {
  const player = payload.player ?? getNickname();
  if (!player) return false;
  const body: PostScorePayload = {
    player,
    level_id: payload.level_id,
    score: payload.score,
    moves_left: payload.moves_left,
  };
  try {
    await request<unknown>("/scores", { method: "POST", body: JSON.stringify(body) });
    return true;
  } catch {
    enqueuePending({ kind: "score", payload: body });
    return false;
  }
}

export interface PostProgressPayload {
  player: string;
  level_id: number;
  stars: number;
  best_score: number;
  completed: boolean;
}

export async function postProgress(payload: { level_id: number; stars: number; best_score: number; completed: boolean }): Promise<boolean> {
  const player = getNickname();
  if (!player) return false;
  const body: PostProgressPayload = { player, ...payload };
  try {
    await request<unknown>("/progress", { method: "POST", body: JSON.stringify(body) });
    return true;
  } catch {
    enqueuePending({ kind: "progress", payload: body });
    return false;
  }
}

export async function fetchRanking(levelId?: number): Promise<LevelRanking | null> {
  try {
    const q = levelId ? `?level_id=${levelId}` : "";
    return await request<LevelRanking>(`/ranking${q}`);
  } catch {
    return null;
  }
}

/** Asegura un nickname en localStorage; lo devuelve ("" si el usuario cancela). */
export function ensureNickname(): string {
  let nick = getNickname();
  if (!nick) {
    const random = `player${Math.floor(Math.random() * 9000) + 1000}`;
    const answer = window.prompt("Elija un apodo pegagoso (letras y números)", random);
    if (answer) {
      nick = answer.replace(/[^\w ]/g, "").trim().slice(0, 20) || random;
      setNickname(nick);
    }
    return nick;
  }
  return nick;
}
