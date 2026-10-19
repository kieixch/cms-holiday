/**
 * Pembuat tautan WhatsApp.
 *
 * Semua nomor disimpan tanpa "+" dan tanpa spasi (format wa.me), sedangkan
 * pesan disimpan apa adanya lalu di-encode di sini supaya data di database
 * tetap terbaca manusia.
 */

const DEFAULT_MESSAGE = "Hai Holiday Banyuwangi, aku mau tanya paket trip";

export function waHref(number: string, message?: string | null): string {
  const to = number.replace(/[^\d]/g, "");
  const text = (message ?? "").trim() || DEFAULT_MESSAGE;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/**
 * Gabungkan sapaan otomatis dengan pesan WhatsApp.
 *
 * Sapaan ditaruh di depan pesan; salah satu kosong tidak menambah spasi
 * berlebih. Keduanya kosong menghasilkan string kosong supaya pemanggil bisa
 * jatuh ke pesan bawaan `waHref()`.
 */
export function composeWaMessage(
  greeting: string | null | undefined,
  message: string | null | undefined,
): string {
  const g = (greeting ?? "").trim();
  const m = (message ?? "").trim();
  if (!g) return m;
  if (!m) return g;
  return `${g} ${m}`;
}

/**
 * Href tombol WhatsApp dengan dukungan link rotator.
 *
 * Tiap section punya field "link rotator" (link alternatif Bitly dkk.) yang
 * diprioritaskan bila terisi. Nilai yang tidak aman (`javascript:`, dsb.)
 * diabaikan supaya tombol tetap jatuh ke wa.me seperti biasa — tombol tidak
 * pernah jadi tautan mati karena isi field yang salah ketik.
 */
export function waButtonHref(
  override: string | null | undefined,
  number: string,
  message?: string | null,
): string {
  const custom = (override ?? "").trim();
  if (!custom) return waHref(number, message);
  const safe = safeHref(custom);
  return safe === "#" ? waHref(number, message) : safe;
}

export function mailtoHref(email: string): string {
  // Email hanya boleh berisi karakter aman; cegah injeksi skema/parameter.
  const clean = email.trim().replace(/[^a-zA-Z0-9._@+-]/g, "");
  return `mailto:${clean}`;
}

/**
 * Href yang aman dirender, apa pun isinya.
 *
 * Field yang berakhir menjadi `href` (instagram, tiktok, anchor) bisa berisi
 * `javascript:` yang akan tereksekusi saat diklik. Hanya skema dan bentuk yang
 * dikenal yang diloloskan; sisanya jatuh ke `#`.
 */
export function safeHref(href: string): string {
  const value = href.trim();
  if (value === "") return "#";
  if (/^#[\w-]*$/.test(value)) return value; // anchor internal
  if (/^\/(?!\/)/.test(value)) return value; // path relatif, bukan protocol-relative
  if (/^https?:\/\//i.test(value)) return value;
  if (/^mailto:[a-zA-Z0-9._@+-]+$/.test(value)) return value;
  if (/^tel:\+?[0-9().\s-]+$/.test(value)) return value;
  return "#";
}

/** true untuk href yang harus dibuka di tab baru (http/mailto/tel). */
export function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/.test(href);
}

/** Anchor internal (#itinerary, #paket) tetap dipakai apa adanya. */
export function linkAttrs(href: string): {
  href: string;
  target?: string;
  rel?: string;
} {
  const safe = safeHref(href);
  if (!isExternalHref(safe)) return { href: safe };
  return { href: safe, target: "_blank", rel: "noopener" };
}
