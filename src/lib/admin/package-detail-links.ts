/**
 * Aturan tombol paket Open Trip yang punya halaman detail.
 *
 * Paket Open Trip hasil impor tidak punya halaman detail, jadi satu-satunya
 * jalan menuju pemesanan adalah WhatsApp: kartu di kategori memakai tombol
 * "Booking via WhatsApp", dan hero tidak punya tombol booking sama sekali.
 * Begitu halaman detail diaktifkan, aturannya berbalik — kartu harus seperti
 * paket private (membuka halaman detail), dan tombol WhatsApp pindah ke hero
 * supaya jalur pemesanan tidak hilang.
 *
 * Aturan ini dipakai dua kali: `savePackageAction` menyimpan hasilnya, dan
 * live preview memanggil helper yang sama supaya perubahannya terlihat sebelum
 * disimpan. Kalau keduanya punya salinan terpisah, preview akan menunjukkan
 * sesuatu yang tidak pernah muncul di situs.
 *
 * `kind` kategori adalah acuan. Action selalu menyamakan `Package.kind` dengan
 * `category.kind`, jadi keduanya tidak mungkin berbeda.
 */

/** Tombol kartu paket private: membuka halaman detail. */
import type { PackageBodyData } from "@/components/site/views";

export const DETAIL_CARD_BUTTON = "Lihat Detail Paket →";

/** Tombol kartu Open Trip tanpa halaman detail. */
export const WHATSAPP_CARD_BUTTON = "💬 Booking via WhatsApp";

/** Tombol booking di hero, sama dengan yang dipakai paket private. */
export const WHATSAPP_CTA_LABEL = "💬 Booking via WhatsApp";

/**
 * Data preview paket: badan halaman plus kolom yang hanya dibutuhkan editor.
 *
 * `kind`, `hasDetailPage`, `cardLinkMode`, dan `cardButtonLabel` tidak dipakai
 * renderer mana pun — `getPackagePage()` bahkan tidak mengambilnya. Tapi aturan
 * tombol di bawah butuh semuanya, dan editor harus bisa mempratinjau efeknya
 * sebelum disimpan, jadi kolomnya ikut dibawa sebagai base preview alih-alih
 * route publik ikut memuatnya.
 *
 * Dua kolom kartu dibiarkan nullable supaya base ini sama persis dengan baris
 * database; `null` berarti "belum diisi" dan aturan memperlakukannya sama dengan
 * string kosong.
 */
export type PackagePreviewData = PackageBodyData & {
  kind: string;
  hasDetailPage: boolean;
  /** Nama paket — sumber judul kartu listing, terpisah dari `heroTitle`. */
  name: string;
  isFeatured: boolean;
  cardLinkMode: string | null;
  cardButtonLabel: string | null;
};

export type DetailLinkInput = {
  kind: string;
  hasDetailPage: boolean;
  cardLinkMode: string;
  cardButtonLabel: string;
  ctaPrimaryLabel: string;
};

export type DetailLinkResult = Pick<
  DetailLinkInput,
  "cardLinkMode" | "cardButtonLabel" | "ctaPrimaryLabel"
>;

/**
 * Label yang jelas mengarah ke WhatsApp, jadi tidak cocok lagi setelah kartu
 * berubah tujuan ke halaman detail.
 */
function mentionsWhatsapp(label: string): boolean {
  return /whats?app|chat|booking via wa/i.test(label);
}

/**
 * Samakan tombol kartu dan tombol hero dengan kondisi halaman detail.
 *
 * Hanya berlaku untuk Open Trip. Paket private selalu punya halaman detail,
 * jadi aturan ini tidak pernah menyentuhnya.
 *
 * Dua arah, karena keduanya bisa menghasilkan tautan rusak kalau dilewati:
 *
 *   - Halaman detail aktif → kartu membuka halaman detail, dan hero mendapat
 *     tombol WhatsApp karena kartu sudah tidak lagi menuju ke sana.
 *   - Halaman detail nonaktif → kartu kembali ke WhatsApp, sebab
 *     `cardLinkMode = "detail"` akan mengarah ke URL yang tidak ada.
 *
 * Label kustom milik admin tidak pernah ditimpa, kecuali label kosong atau
 * memang menyebut WhatsApp. Memakai label seperti itu di tombol yang sekarang
 * menuju halaman detail akan menyesatkan.
 */
export function syncDetailLinks(input: DetailLinkInput): DetailLinkResult {
  const { kind, hasDetailPage, cardLinkMode, cardButtonLabel, ctaPrimaryLabel } = input;

  if (kind !== "OPEN_TRIP") {
    return { cardLinkMode, cardButtonLabel, ctaPrimaryLabel };
  }

  if (hasDetailPage) {
    return {
      cardLinkMode: "detail",
      cardButtonLabel:
        cardButtonLabel === "" || mentionsWhatsapp(cardButtonLabel) ? DETAIL_CARD_BUTTON : cardButtonLabel,
      ctaPrimaryLabel: ctaPrimaryLabel === "" ? WHATSAPP_CTA_LABEL : ctaPrimaryLabel,
    };
  }

  return {
    cardLinkMode: "whatsapp",
    cardButtonLabel:
      cardButtonLabel === "" || cardButtonLabel === DETAIL_CARD_BUTTON
        ? WHATSAPP_CARD_BUTTON
        : cardButtonLabel,
    ctaPrimaryLabel,
  };
}