import Image from "next/image";
import Link from "next/link";
import { waButtonHref } from "@/lib/wa";

export type PackageCardData = {
  slug: string;
  name: string;
  isFeatured: boolean;
  cardVariant: string;
  cardLinkMode: string;
  cardImage: string | null;
  cardImageAlt: string | null;
  cardLoc: string | null;
  /** Label lokasi versi beranda; fallback ke `cardLoc` bila kosong. */
  cardHomeLoc: string | null;
  cardTag: string | null;
  cardRating: string | null;
  cardHighlight: string | null;
  cardButtonLabel: string | null;
  /**
   * Link rotator untuk tombol kartu saat `cardLinkMode = "whatsapp"`.
   * Kosong = wa.me seperti biasa.
   */
  cardWaLink: string | null;
  waMessage: string;
  cardDays: { label: string; title: string }[];
  cardPrices: { label: string; value: string; unit: string | null }[];
  cardFacilities: { label: string }[];
};

/**
 * Bentuk kartu berbeda per halaman, meskipun paketnya sama:
 *  - `home`     → ringkasan satu baris (`.package-highlight`) + rating.
 *  - `listing`  → rincian per hari (`.package-days`) + rating.
 *  - `opentrip` → pill fasilitas + daftar harga (`.price-item`), tombol WhatsApp.
 *                 Kartu promosi 3H2M juga memakai `.package-days`.
 *
 * Ketiganya memakai `.package-card` yang sama, jadi cukup satukan di sini.
 *
 * Catatan: `cardLoc` dan `cardRating` sudah tersimpan lengkap dengan emoji-nya
 * (mis. "📍 Green Island", "⭐ 4.8 • 1,45K Review") karena itulah isi span di
 * markup legacy — jangan menambahkan emoji lagi di sini.
 */
export type CardContext = "home" | "listing" | "opentrip";

type PackageCardProps = {
  pkg: PackageCardData;
  waNumber: string;
  context: CardContext;
  featured?: boolean;
  sizes?: string;
};

export function PackageCard({ pkg, waNumber, context, featured, sizes }: PackageCardProps) {
  const isWhatsapp = pkg.cardLinkMode === "whatsapp";
  const href = isWhatsapp
    ? waButtonHref(pkg.cardWaLink, waNumber, pkg.waMessage)
    : `/${pkg.slug}/`;
  // Kartu promosi di Open Trip melebar penuh dan tampil dua kolom.
  const isFeatured = featured ?? pkg.isFeatured;
  const isOpenTrip = context === "opentrip";

  // Di markup legacy, kartu beranda memakai label lokasi yang lebih umum
  // ("Rute Kombinasi") daripada kartu di halaman kategori ("Green Island").
  const loc = context === "home" ? (pkg.cardHomeLoc || pkg.cardLoc) : pkg.cardLoc;

  const priceBlock =
    pkg.cardPrices.length === 0 ? null : isOpenTrip ? (
      <div className="package-price">
        {pkg.cardPrices.map((p) => (
          <div className="price-item" key={p.label + p.value}>
            <span className="label">{p.label}</span>
            <span className="price">
              {p.value} {p.unit ? <span>{p.unit}</span> : null}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className="package-price">
        <span className="label">{pkg.cardPrices[0].label}</span>
        <span className="price">
          {pkg.cardPrices[0].value}{" "}
          {pkg.cardPrices[0].unit ? <span>{pkg.cardPrices[0].unit}</span> : null}
        </span>
      </div>
    );

  return (
    <div className={`package-card${isFeatured ? " featured" : ""}`}>
      {pkg.cardImage ? (
        <div className="package-img">
          <Image
            src={pkg.cardImage}
            alt={pkg.cardImageAlt || ""}
            fill
            sizes={sizes ?? "(max-width: 768px) 100vw, 33vw"}
          />
          {loc ? <span className="package-loc">{loc}</span> : null}
        </div>
      ) : null}
      <div className="package-body">
        {pkg.cardTag ? <span className="package-tag">{pkg.cardTag}</span> : null}
        <h3>{pkg.name}</h3>
        {pkg.cardRating ? (
          <span className="package-rating">{pkg.cardRating}</span>
        ) : null}

        {context !== "home" && pkg.cardDays.length > 0 ? (
          <div className="package-days">
            {pkg.cardDays.map((d) => (
              <div className="day-row" key={d.label}>
                <strong>{d.label}:</strong> {d.title}
              </div>
            ))}
          </div>
        ) : null}

        {context === "home" && pkg.cardHighlight ? (
          <div className="package-highlight">{pkg.cardHighlight}</div>
        ) : null}

        {isOpenTrip && pkg.cardFacilities.length > 0 ? (
          <div className="trip-facilities">
            {pkg.cardFacilities.map((f) => (
              <span className="facility-pill" key={f.label}>
                {f.label}
              </span>
            ))}
          </div>
        ) : null}

        {priceBlock}

        {pkg.cardButtonLabel ? (
          isWhatsapp ? (
            <a
              className="btn btn-block"
              href={href}
              target="_blank"
              rel="noopener"
            >
              {pkg.cardButtonLabel}
            </a>
          ) : (
            <Link className="btn btn-block" href={href}>
              {pkg.cardButtonLabel}
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}
