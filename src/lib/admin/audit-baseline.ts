import "server-only";

import { spawn } from "node:child_process";

/**
 * Rekam ulang baseline teks audit setelah konten disimpan.
 *
 * Baseline harus mencerminkan teks yang baru saja dipublikasikan, jadi script
 * `scripts/audit-baseline.mjs` dijalankan sebagai proses terpisah yang me-fetch
 * situs yang sedang jalan. Dijalankan detached supaya tidak menahan server
 * action, dan kegagalannya tidak pernah menggagalkan penyimpanan.
 *
 * URL dasar diambil dari env, BUKAN dari header `Host`. Header itu dikendalikan
 * pengirim, jadi memakainya berarti penyerang bisa memaksa server me-fetch host
 * sembarang (SSRF). Kalau env tidak diisi, refresh dilewati — lebih baik tidak
 * ada baseline baru daripada membuka SSRF.
 */
export async function refreshAuditBaseline(): Promise<void> {
  try {
    const base = process.env.AUDIT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) return;

    const child = spawn(process.execPath, ["scripts/audit-baseline.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, BASE_URL: base },
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (error) {
    console.error("[audit-baseline] gagal menjadwalkan refresh:", error);
  }
}