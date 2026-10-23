import Image from "next/image";

import { imageUnoptimized } from "@/lib/media";

export type TypeCardData = {
  slug: string;
  icon: string;
  description: string;
  price: string;
  linkLabel: string;
  /** Opsional. Kalau null, kartu dirender persis seperti markup legacy. */
  image?: string | null;
  imageAlt?: string | null;
};

/**
 * Kartu "pilihan tipe trip" di beranda; seluruh kartu adalah satu <a>.
 *
 * `t.image` sengaja dirender hanya kalau terisi. Kategori hasil impor tidak
 * punya gambar, dan menyisipkan elemen kosong akan mengubah markup halaman
 * beranda yang sudah lolos audit kesesuaian dengan situs asli.
 */
export function TypeCardGrid({ items }: { items: (TypeCardData & { name: string })[] }) {
  return (
    <div className="type-grid">
      {items.map((t) => (
        <a key={t.slug} href={`/${t.slug}/`} className="type-card">
          {t.image ? (
            <Image
              className="type-card__image"
              src={t.image}
              alt={t.imageAlt ?? ""}
              width={480}
              height={336}
              // Host luar yang tidak terdaftar tetap dirender langsung; media
              // R2 lewat optimizer supaya tetap tampil walau `r2.dev` diblokir
              // di jaringan pengunjung.
              unoptimized={imageUnoptimized(t.image)}
            />
          ) : (
            <div className="type-icon">{t.icon}</div>
          )}
          <h3>{t.name}</h3>
          <p>{t.description}</p>
          <span className="type-price">{t.price}</span>
          <span className="type-link">{t.linkLabel}</span>
        </a>
      ))}
    </div>
  );
}

export type BenefitData = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

export function BenefitGrid({ items }: { items: BenefitData[] }) {
  if (items.length === 0) return null;
  return (
    <div className="benefit-grid">
      {items.map((b) => (
        <div className="benefit-card" key={b.id}>
          <div className="benefit-icon">{b.icon}</div>
          <h4>{b.title}</h4>
          <p>{b.description}</p>
        </div>
      ))}
    </div>
  );
}

export type TestimonialData = {
  stars: number;
  /** Kutipan sudah termasuk tanda kutip dari markup legacy — jangan dibungkus lagi. */
  quote: string;
  author: string;
  location: string;
};

export function TestimonialGrid({ items }: { items: TestimonialData[] }) {
  if (items.length === 0) return null;

  // Marquee geser: track diisi dua rangkaian identik lalu digeser -50% dan
  // diulang, jadi testimoni baru otomatis ikut tampil di samping tanpa jeda.
  // Rangkaian digandakan beberapa kali supaya satu putaran selalu lebih lebar
  // dari wadahnya (layar lebar sekalipun tidak menyisakan ruang kosong).
  const copies = Math.max(1, Math.ceil(6 / items.length));
  const sequence = Array.from({ length: copies }, () => items).flat();
  const loop = [...sequence, ...sequence];

  return (
    <div className="hbgl-testimonial-marquee">
      <div className="testimonial-grid hbgl-testimonial-track">
        {loop.map((t, i) => (
          <div
            className="testimonial-card"
            key={`${t.author}-${i}`}
            // Salinan untuk menyambung animasi disembunyikan dari pembaca layar.
            aria-hidden={i >= sequence.length ? true : undefined}
          >
            <div className="stars">{"⭐".repeat(Math.max(0, Math.min(5, t.stars)))}</div>
            <p className="quote">{t.quote}</p>
            <div className="author">
              {t.author}
              <span>{t.location}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
