/**
 * Ikon Instagram bergaya garis.
 *
 * Dipakai di dua tempat: penanda hover kartu feed (client) dan baris brand
 * seksi Instagram di beranda (server). Sengaja dibuat komponen polos tanpa
 * `"use client"` supaya keduanya bisa mengimpornya tanpa menarik boundary
 * klien ke halaman server.
 */
export function InstagramGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="17.4" cy="6.6" r="1.3" fill="currentColor" />
    </svg>
  );
}
