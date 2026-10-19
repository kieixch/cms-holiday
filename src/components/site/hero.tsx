import Image from "next/image";
import { waButtonHref } from "@/lib/wa";
import { HeroSecondaryLink } from "./hero-secondary-link";

export type SectionHeadProps = {
  tag?: string | null;
  /** Bagian judul biasa sebelum <span class="accent">. */
  title?: string | null;
  /** Isi <span class="accent">. */
  accent?: string | null;
  /** Teks setelah accent, tetap warna biasa. */
  suffix?: string | null;
  desc?: string | null;
};

/**
 * Kepala seksi. Menghasilkan markup datar (bukan pembungkus tambahan) supaya
 * cocok dengan `.section-tag` / `.section-title` / `.section-desc` di legacy.
 */
export function SectionHead({ tag, title, accent, suffix, desc }: SectionHeadProps) {
  if (!tag && !title && !accent && !suffix && !desc) return null;
  return (
    <>
      {tag ? <span className="section-tag">{tag}</span> : null}
      <h2 className="section-title">
        {title}
        {accent ? <span className="accent">{accent}</span> : null}
        {suffix}
      </h2>
      {desc ? <p className="section-desc">{desc}</p> : null}
    </>
  );
}

/** Bagian halaman yang bisa jadi tujuan tombol sekunder hero. */
export type HeroAnchorKey =
  | "itinerary"
  | "facilities"
  | "pricing"
  | "gallery"
  | "benefits"
  | "listing";

export type HeroAnchors = Partial<Record<HeroAnchorKey, string>>;

/**
 * Kata kunci pada teks tombol sekunder -> bagian yang dituju.
 *
 * Urutannya penting: yang lebih spesifik dicek dulu, dan `listing` ("paket",
 * "trip") diletakkan paling akhir supaya teks seperti "Lihat Itinerary Paket"
 * tetap dianggap menuju itinerary.
 */
const SECONDARY_TARGETS: { key: HeroAnchorKey; pattern: RegExp }[] = [
  { key: "itinerary", pattern: /itiner|jadwal|rute|rundown|rencana/i },
  { key: "facilities", pattern: /fasilitas|fasilit|termasuk|include|perlengkapan/i },
  { key: "pricing", pattern: /harga|biaya|tarif|price|bayar|budget/i },
  { key: "gallery", pattern: /galeri|foto|dokumentasi|album/i },
  { key: "benefits", pattern: /keunggulan|manfaat|alasan|kenapa|kualitas/i },
  { key: "listing", pattern: /paket|trip|pilih|daftar|destinasi|listing/i },
];

/**
 * Tentukan tujuan tombol sekunder hero dari teks tombolnya.
 *
 * Situs lama memakai satu anchor tetap (`#itinerary`), jadi tombol di halaman
 * kategori yang isinya "Lihat Paket" tidak kemana-mana. Sekarang teks yang
 * menentukan: "Lihat Fasilitas" menuju bagian fasilitas, "Lihat Harga" menuju
 * bagian harga, dan seterusnya. `fallback` (nilai anchor tersimpan) hanya
 * dipakai kalau teksnya tidak dikenali, dan `preferred` jadi tujuan terakhir
 * supaya tombol tidak pernah menggantung tanpa arah.
 */
export function resolveSecondaryAnchor(
  label: string,
  anchors: HeroAnchors,
  fallback?: string,
  preferred?: HeroAnchorKey,
): string | undefined {
  const text = label.toLowerCase();
  for (const { key, pattern } of SECONDARY_TARGETS) {
    const anchor = anchors[key];
    if (anchor && pattern.test(text)) return `#${anchor}`;
  }

  const valid = new Set(Object.values(anchors).filter((value): value is string => Boolean(value)));
  const clean = fallback?.replace(/^#/, "").trim();
  if (clean && valid.has(clean)) return `#${clean}`;

  const preferredAnchor = preferred ? anchors[preferred] : undefined;
  return preferredAnchor ? `#${preferredAnchor}` : undefined;
}

export type HeroProps = {
  badges: string[];
  title: string;
  accent: string;
  suffix: string;
  description: string;
  decos: string[];
  primaryLabel: string;
  secondaryLabel: string;
  /** Tujuan tombol sekunder, mis. "#itinerary". Tidak dirender kalau kosong. */
  secondaryAnchor?: string;
  waNumber: string;
  waMessage: string;
  /**
   * Link rotator untuk tombol WhatsApp utama. Bila terisi (mis. link Bitly),
   * tombol menuju link itu; kalau kosong tetap wa.me seperti biasa.
   */
  primaryLink?: string | null;
  /** Baris statistik, hanya di beranda. */
  stats?: { num: string; label: string }[];
  /**
   * Gambar hero (cinematic). Kalau ada, dipakai sebagai latar belakang
   * bertepi gelap di sisi kanan panel — "re-present existing image".
   */
  media?: { src: string; alt: string };
};

/** Hero. `<h1>` memakai accent sebagai `<span>` tanpa class, seperti markup asli. */
export function Hero({
  badges,
  title,
  accent,
  suffix,
  description,
  decos,
  primaryLabel,
  secondaryLabel,
  secondaryAnchor,
  waNumber,
  waMessage,
  primaryLink,
  stats,
  media,
}: HeroProps) {
  return (
    <section className="container hbgl-hero-bleed" data-reveal>
      <div className={`hero${media ? " hbgl-hero--media" : ""}`}>
        {media ? (
          <div className="hbgl-hero-media">
            <Image
              src={media.src}
              alt={media.alt || ""}
              fill
              sizes="(max-width: 860px) 100vw, 55vw"
              className="hbgl-hero-img"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        ) : null}
        {decos.slice(0, 4).map((deco, i) => (
          <span key={deco + i} className={`hero-deco hero-deco-${i + 1}`}>
            {deco}
          </span>
        ))}
        <div className="hbgl-hero-divider" aria-hidden="true">
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
            <path d="M0,58 C180,96 360,18 540,40 C720,62 900,110 1080,84 C1260,58 1350,40 1440,54 L1440,120 L0,120 Z" />
          </svg>
        </div>
        <div className="hero-content">
          {badges.length > 0 ? (
            <div className="hero-badges">
              {badges.map((b) => (
                <span className="badge" key={b}>
                  {b}
                </span>
              ))}
            </div>
          ) : null}
          <h1>
            {title} {accent ? <span>{accent}</span> : null} {suffix}
          </h1>
          {description ? <p>{description}</p> : null}
          <div className="hero-cta">
            {/* Tanpa kondisi, paket tanpa label apa pun akan menampilkan tombol
                WhatsApp kosong yang tetap bisa diklik dan menjebak user. */}
            {primaryLabel ? (
              <a
                className="btn btn-primary"
                href={waButtonHref(primaryLink, waNumber, waMessage)}
                target="_blank"
                rel="noopener"
              >
                {primaryLabel}
              </a>
            ) : null}
            {secondaryLabel && secondaryAnchor ? (
              <HeroSecondaryLink href={secondaryAnchor}>{secondaryLabel}</HeroSecondaryLink>
            ) : null}
          </div>
          {stats && stats.length > 0 ? (
            <div className="stats-bar">
              {stats.map((s) => (
                <div className="stat-item" key={s.label}>
                  <div className="num">{s.num}</div>
                  <div className="lbl">{s.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
