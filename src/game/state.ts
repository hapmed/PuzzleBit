/** Progreso local del jugador: niveles, estrellas, boosters y reto diario. */

const KEY_PROGRESS = "pb.progress.v1";
const KEY_DAILY = "pb.daily.v1";
const KEY_BOOSTERS = "pb.boosters.v1";
const KEY_NICKNAME = "pb.nickname.v1";
const KEY_PENDING = "pb.pending.v1";
const KEY_TUTORIAL = "pb.tutorial.v1";

/** ¿Ya vio el tutorial de primera vez? */
export function isTutorialDone(): boolean {
  return localStorage.getItem(KEY_TUTORIAL) === "1";
}

/** Marca el tutorial como visto (para no volver a mostrarlo). */
export function markTutorialDone(): void {
  try {
    localStorage.setItem(KEY_TUTORIAL, "1");
  } catch {
    /* sin storage: no vuelve a molestar */
  }
}


export interface LevelProgress {
  stars: number;
  bestScore: number;
  completed: boolean;
}

type ProgressMap = Record<string, LevelProgress>;

export interface DailyState {
  date: string;
  done: boolean;
  best: number;
}

export interface Boosters {
  hammer: number;
  shuffle: number;
  move: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getLevelProgress(levelId: number): LevelProgress {
  const map = safeParse<ProgressMap>(localStorage.getItem(KEY_PROGRESS), {});
  return map[String(levelId)] ?? { stars: 0, bestScore: 0, completed: false };
}

export function getAllProgress(): ProgressMap {
  return safeParse<ProgressMap>(localStorage.getItem(KEY_PROGRESS), {});
}

/** Guarda el resultado de un nivel y desbloquea el siguiente. */
export function recordLevelResult(levelId: number, score: number, stars: number): LevelProgress {
  const map = safeParse<ProgressMap>(localStorage.getItem(KEY_PROGRESS), {});
  const key = String(levelId);
  const prev = map[key] ?? { stars: 0, bestScore: 0, completed: false };
  const next: LevelProgress = {
    stars: Math.max(prev.stars, stars),
    bestScore: Math.max(prev.bestScore, score),
    completed: true,
  };
  map[key] = next;
  localStorage.setItem(KEY_PROGRESS, JSON.stringify(map));

  const wasFirst3 = prev.stars < 3 && next.stars === 3;
  if (wasFirst3) {
    const b = getBoosters();
    setBoosters({ ...b, hammer: b.hammer + 1 });
  }
  return next;
}

/** Nivel máximo jugable (secuencial). */
export function maxPlayableLevel(totalLevels: number): number {
  const map = getAllProgress();
  let unlocked = 1;
  for (let i = 1; i < totalLevels; i++) {
    const p = map[String(i)];
    if (p?.completed) unlocked = Math.max(unlocked, i + 1);
  }
  return Math.min(unlocked, totalLevels);
}

export function isLevelPlayable(levelId: number, totalLevels: number): boolean {
  return levelId <= maxPlayableLevel(totalLevels);
}

/**
 * Siguiente nivel del modo infinito jugable (id > totalLevels).
 * Progresión secuencial propia: se avanza al completar el nivel ∞ anterior.
 */
export function maxEndlessLevel(totalLevels: number): number {
  const map = getAllProgress();
  let id = totalLevels;
  while (map[String(id + 1)]?.completed) id++;
  return id + 1;
}

/** El modo infinito se abre al completar al menos un nivel de campaña. */
export function isEndlessUnlocked(totalLevels: number): boolean {
  const map = getAllProgress();
  for (let i = 1; i <= totalLevels; i++) {
    if (map[String(i)]?.completed) return true;
  }
  return false;
}

/** La campaña (nivel N) quedó completada: el modo infinito encadena desde ahí. */
export function isCampaignCompleted(totalLevels: number): boolean {
  return !!getAllProgress()[String(totalLevels)]?.completed;
}

// ——— Nivel de reanudación (sin pantalla de selección) ———
const KEY_LAST_PLAYED = "pb.lastplayed.v1";

/** Último nivel de campaña jugado (0 si nunca se jugó). */
export function getLastPlayedLevel(): number {
  const raw = safeParse<{ v: number }>(localStorage.getItem(KEY_LAST_PLAYED), { v: 0 });
  return raw.v || 0;
}

/** Recordar el nivel actual para reabrir el juego exactamente ahí. */
export function recordLastPlayed(levelId: number): void {
  localStorage.setItem(KEY_LAST_PLAYED, JSON.stringify({ v: levelId }));
}

/**
 * Nivel al que entra el juego directo al abrir:
 * último jugado; si nunca se jugó, el siguiente desbloqueado.
 */
export function resumeLevel(lastFallback: number): number {
  const last = getLastPlayedLevel();
  return last > 0 ? last : lastFallback;
}

// ——— Reto diario ———
export function getDailyState(): DailyState {
  const s = safeParse<DailyState>(localStorage.getItem(KEY_DAILY), { date: "", done: false, best: 0 });
  if (s.date !== todayDateString()) return { date: todayDateString(), done: false, best: 0 };
  return s;
}

export function recordDailyResult(score: number, stars: number): void {
  const prev = getDailyState();
  const next: DailyState = { date: prev.date, done: true, best: Math.max(prev.best, score) };
  localStorage.setItem(KEY_DAILY, JSON.stringify(next));
  const b = getBoosters();
  setBoosters({ hammer: b.hammer + 1, shuffle: b.shuffle + 1, move: b.move + 1 });
  void stars;
}

// ——— Boosters ———
export function getBoosters(): Boosters {
  return safeParse<Boosters>(localStorage.getItem(KEY_BOOSTERS), { hammer: 3, shuffle: 3, move: 2 });
}

export function setBoosters(b: Boosters): void {
  localStorage.setItem(KEY_BOOSTERS, JSON.stringify(b));
}

export function spendBooster(kind: keyof Boosters): boolean {
  const b = getBoosters();
  if (b[kind] <= 0) return false;
  b[kind]--;
  setBoosters(b);
  return true;
}

// ——— Nickname ———
export function getNickname(): string {
  return localStorage.getItem(KEY_NICKNAME) ?? "";
}

export function setNickname(nick: string): void {
  localStorage.setItem(KEY_NICKNAME, nick.trim().slice(0, 20));
}

// apodos graciosos (sin acentos: el backend solo acepta [A-Za-z0-9 _-]).
const NICK_HONORIFICS = ["Capitan", "Don", "Sr.", "Dra.", "Gran", "Turbo", "Mega", "Super", "Lord", "Peque"];
const NICK_NOUNS = [
  "Babosa", "Cacahuate", "Taco", "Pepinillo", "Chimichanga", "Nugget", "Waffle",
  "Dorito", "Frijol", "Zanahoria", "Pinguino", "Tostada", "Pulpo", "Croqueta", "Gansito",
];
const NICK_TAILS = ["", "Veloz", "Cosmico", "Colorao", "Saltarin", "Chido", "Sonriente", "Fugaz"];

/** Apodo aleatorio gracioso, max 20 chars, seguro para el backend. */
export function randomFunnyNickname(): string {
  const r = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const middle = Math.random() < 0.55 ? NICK_TAILS[Math.floor(Math.random() * NICK_TAILS.length)] : "";
  let nick = `${r(NICK_HONORIFICS)} ${r(NICK_NOUNS)}`;
  if (middle) nick += ` ${middle}`;
  if (Math.random() < 0.12) nick = `${nick} ${1 + Math.floor(Math.random() * 99)}`;
  nick = nick.split(" ")
    .reduce<string[]>((acc, w) => (acc.join(" ").length + (acc.length ? 1 : 0) + w.length <= 20 ? [...acc, w] : acc), [])
    .join(" ")
    .trim();
  return nick || "Jugador 1";
}

/** Asigna apodo la primera vez (y avisa con true para mostrar el banner). */
export function ensureNickname(): boolean {
  if (!getNickname()) {
    setNickname(randomFunnyNickname());
    return true;
  }
  return false;
}

// ——— Cola offline de sincronización ———
export interface PendingOp {
  kind: "progress" | "score";
  payload: unknown;
}

export function enqueuePending(op: PendingOp): void {
  const q = safeParse<PendingOp[]>(localStorage.getItem(KEY_PENDING), []);
  q.push(op);
  localStorage.setItem(KEY_PENDING, JSON.stringify(q.slice(-200)));
}

export function drainPending(): PendingOp[] {
  const q = safeParse<PendingOp[]>(localStorage.getItem(KEY_PENDING), []);
  localStorage.setItem(KEY_PENDING, "[]");
  return q;
}

export function pendingCount(): number {
  return safeParse<PendingOp[]>(localStorage.getItem(KEY_PENDING), []).length;
}
