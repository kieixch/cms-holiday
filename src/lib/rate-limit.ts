import "server-only";

/**
 * Pembatas laju percobaan login (in-memory).
 *
 * Menahan brute force pada `/adm-cms-hb/login`. Dihitung per kunci (mis. IP dan
 * IP+email) dengan jendela tetap: setelah `MAX_FAILURES` kegagalan dalam
 * `WINDOW_MS`, kunci diblokir `BLOCK_MS`.
 *
 * Batasan yang disadari: state disimpan di memori proses, jadi pada deployment
 * multi-instance (serverless) tiap instance punya penghitung sendiri. Untuk
 * satu VPS/instance ini sudah cukup menutup celah brute force; kalau nanti
 * dipasangkan di banyak instance, ganti penyimpanannya ke Redis/Upstash tanpa
 * mengubah pemanggil.
 */

type Entry = { failures: number; windowStart: number; blockedUntil: number };

const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_KEYS = 5000;

/** State ditahan di `globalThis` supaya tidak hilang saat HMR di dev. */
const globalForLimit = globalThis as unknown as { hbLoginRate?: Map<string, Entry> };
const store = globalForLimit.hbLoginRate ?? new Map<string, Entry>();
globalForLimit.hbLoginRate = store;

function entryFor(key: string, now: number): Entry {
  let entry = store.get(key);
  if (!entry) {
    entry = { failures: 0, windowStart: now, blockedUntil: 0 };
    store.set(key, entry);
  }
  // Jendela kedaluwarsa: mulai hitungan baru.
  if (now - entry.windowStart > WINDOW_MS) {
    entry.failures = 0;
    entry.windowStart = now;
  }
  return entry;
}

function prune(now: number): void {
  if (store.size <= MAX_KEYS) return;

  // 1) Buang entry kedaluwarsa: jendela habis dan tidak sedang diblokir.
  for (const [key, entry] of store) {
    if (entry.blockedUntil <= now && now - entry.windowStart > WINDOW_MS) {
      store.delete(key);
    }
  }
  if (store.size <= MAX_KEYS) return;

  // 2) Masih penuh? Buang yang paling lama — TAPI jangan pernah `clear()`:
  //    menghapus seluruh map juga menghapus blokir yang sedang aktif, dan
  //    penyerang bisa memicunya sengaja (buat >5000 kunci unik) untuk
  //    me-reset pembatasan brute force miliknya sendiri. Entry yang gagal
  //    mendekati ambang blokir (`>= MAX_FAILURES / 2`) dipertahankan supaya
  //    penghitung percobaan yang hampir kena blokir tidak hilang di tengah jalan.
  const evictable = [...store.entries()]
    .filter(([, entry]) => entry.blockedUntil <= now && entry.failures < MAX_FAILURES / 2)
    .sort((a, b) => a[1].windowStart - b[1].windowStart);
  for (const [key] of evictable) {
    if (store.size <= MAX_KEYS) break;
    store.delete(key);
  }
  // 3) Kalau semuanya terlindungi, biarkan tumbuh sedikit: lebih baik memakai
  //    memori beberapa ribu entry daripada menghapus blokir yang aktif.
}

export function checkLoginRate(key: string): { allowed: boolean; retryAfterS: number } {
  const now = Date.now();
  const entry = entryFor(key, now);
  if (entry.blockedUntil > now) {
    return { allowed: false, retryAfterS: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterS: 0 };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = entryFor(key, now);
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.blockedUntil = now + BLOCK_MS;
    entry.failures = 0;
    entry.windowStart = now;
  }
  prune(now);
}

export function clearLoginRate(key: string): void {
  store.delete(key);
}