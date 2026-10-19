import Image from "next/image";

export type PricingData = {
  kind: string;
  note: string | null;
  rowHeaderLabel: string | null;
  columns: { id: string; label: string; cssClass: string | null }[];
  rows: { id: string; label: string; values: { columnId: string; value: string }[] }[];
  items: { label: string; value: string; unit: string | null }[];
};

/**
 * Blok harga paket.
 *
 * Dua bentuk, mengikuti markup legacy:
 *  - `table` → `.price-table-wrap` + `<table class="price-table">`, nilai tiap sel
 *    dibungkus `<span class="price-tag">` dengan kelas kolom untuk warna pill.
 *  - `items` → daftar `.price-item` (dipakai paket tanpa tabel).
 */
export function Pricing({ pricing }: { pricing: PricingData | null }) {
  if (!pricing) return null;

  if (pricing.kind === "TABLE" && pricing.rows.length > 0) {
    return (
      <>
        <div className="price-table-wrap">
          <table className="price-table">
            <thead>
              <tr>
                <th>{pricing.rowHeaderLabel ?? ""}</th>
                {pricing.columns.map((c) => (
                  <th key={c.id}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pricing.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  {pricing.columns.map((c) => {
                    const v = r.values.find((x) => x.columnId === c.id)?.value ?? "";
                    return (
                      <td key={c.id} className={c.cssClass ?? undefined}>
                        <span className="price-tag">{v}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pricing.note ? <p className="price-note">{pricing.note}</p> : null}
      </>
    );
  }

  if (pricing.items.length === 0) return null;
  return (
    <div className="package-price">
      {pricing.items.map((it, i) => (
        <div className="price-item" key={`${it.label}-${i}`}>
          <span className="label">{it.label}</span>
          <span className="price">
            {it.value} {it.unit ? <span>{it.unit}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export type GalleryImageData = { id: string; url: string; alt: string };

/**
 * Galeri foto. `columns` diambil dari CSS asli (paket Djawatan = 2 kolom,
 * sisanya 4 kolom sesuai `.gallery-grid` bawaan).
 */
export function GalleryGrid({
  images,
  columns,
}: {
  images: GalleryImageData[];
  columns: number;
}) {
  if (images.length === 0) return null;
  const cols = Math.max(1, Math.min(4, columns || 4));
  return (
    <div className={`gallery-grid cols-${cols}`}>
      {images.map((g) => (
        <div className="gallery-item" key={g.id}>
          <Image
            src={g.url}
            alt={g.alt}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
