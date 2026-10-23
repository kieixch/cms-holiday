"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";

import {
  deleteAssetAndRedirectAction,
  deleteAssetsAction,
  updateAssetAltAction,
} from "./actions";
import { clampPer, DEFAULT_PER, ROWS_PER_PAGE } from "./pagination";

type Asset = {
  id: string;
  filename: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  folder: string;
  derivedFromId: string | null;
};

export function GalleryGrid({
  assets,
  per,
  term,
  backTo,
}: {
  assets: Asset[];
  per: number;
  term: string;
  backTo: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Pilihan disimpan per halaman: hanya aset yang sedang tampil yang bisa
  // dihapus, jadi pindah halaman tidak membawa pilihan lama ke halaman lain.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const chosen = assets.filter((asset) => selected.has(asset.id));
  const allSelected = assets.length > 0 && chosen.length === assets.length;

  const toggle = (assetId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });

  // Jumlah kolom ditentukan CSS (`auto-fill`), bukan angka tetap, jadi server
  // tidak bisa tahu berapa item yang pas untuk 3 baris. Ukur di sini lalu minta
  // server mengirim ulang dengan `?per=` yang benar. Reset ke halaman 1 karena
  // offset halaman lama jadi tidak relevan setelah ukuran halaman berubah.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const sync = () => {
      const tracks = getComputedStyle(grid).gridTemplateColumns;
      const columns = tracks.split(" ").filter(Boolean).length;
      if (columns === 0) return;

      // Clamp yang sama dengan server: tanpa ini layar sangat lebar (atau
      // `per` yang sudah dibatasi server) bisa memicu replace berulang.
      const nextPer = clampPer(columns * ROWS_PER_PAGE);
      if (nextPer === per) return;

      const params = new URLSearchParams();
      if (term) params.set("q", term);
      if (nextPer !== DEFAULT_PER) params.set("per", String(nextPer));
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    sync();

    // ResizeObserver, bukan `resize` window: lebar grid juga berubah saat
    // sidebar ditutup/dibuka tanpa viewport berubah.
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(sync, 200);
    });
    observer.observe(grid);

    return () => {
      clearTimeout(debounce);
      observer.disconnect();
    };
  }, [per, term, pathname, router]);

  return (
    <>
      <div className="admin-bulkbar" role="group" aria-label="Pilih gambar">
        <label className="admin-bulkbar__all">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(assets.map((a) => a.id)))
            }
            disabled={assets.length === 0}
          />
          Pilih semua
        </label>

        <span className="admin-bulkbar__count">
          {chosen.length > 0
            ? `${chosen.length} gambar dipilih`
            : "Centang gambar untuk hapus sekaligus"}
        </span>

        {chosen.length > 0 ? (
          <button
            type="button"
            className="admin-btn admin-btn--small admin-btn--ghost"
            onClick={() => setSelected(new Set())}
          >
            Batalkan
          </button>
        ) : null}

        <div className="admin-bulkbar__end">
          {chosen.length > 0 ? (
            <form action={deleteAssetsAction} className="admin-inline-form">
              <input type="hidden" name="back" value={backTo} />
              {chosen.map((asset) => (
                <input key={asset.id} type="hidden" name="ids" value={asset.id} />
              ))}
              <ConfirmSubmit
                className="admin-btn admin-btn--small admin-btn--danger"
                confirm={`Hapus ${chosen.length} gambar? File di storage juga ikut dihapus dan tidak bisa dikembalikan.`}
              >
                Hapus terpilih
              </ConfirmSubmit>
            </form>
          ) : (
            <button type="button" className="admin-btn admin-btn--small admin-btn--danger" disabled>
              Hapus terpilih
            </button>
          )}
        </div>
      </div>

      <div className="admin-media-grid" ref={gridRef}>
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            backTo={backTo}
            selected={selected.has(asset.id)}
            onToggle={() => toggle(asset.id)}
          />
        ))}
      </div>
    </>
  );
}

function AssetCard({
  asset,
  backTo,
  selected,
  onToggle,
}: {
  asset: Asset;
  backTo: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const [alt, setAlt] = useState(asset.alt);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height}` : "—";

  return (
    <figure className={selected ? "admin-media-card is-selected" : "admin-media-card"}>
      <div className="admin-media-card__thumb">
        <Link href={`/adm-cms-hb/gallery/${asset.id}`} title="Sunting gambar ini">
          <Image
            src={asset.url}
            alt={asset.alt || asset.filename}
            width={asset.width ?? 400}
            height={asset.height ?? 300}
            sizes="(max-width: 700px) 45vw, 240px"
            style={{ objectFit: "cover" }}
          />
        </Link>
        {asset.derivedFromId ? <span className="admin-media-card__badge">Hasil suntingan</span> : null}
        <label className="admin-media-card__select" title="Pilih gambar ini">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Pilih ${asset.filename}`}
          />
        </label>
      </div>

      <figcaption className="admin-media-card__body">
        <p className="admin-media-card__name" title={asset.filename}>
          {asset.filename}
        </p>
        <p className="admin-media-card__meta">
          {kb(asset.size)} · {dimensions} · {asset.mime.replace("image/", "")}
        </p>
        <p className="admin-media-card__folder">{asset.folder}</p>

        <label className="admin-field admin-field--tight">
          <span className="admin-field__label">Teks alternatif</span>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            disabled={pending}
            placeholder="Deskripsi foto"
          />
        </label>

        <div className="admin-media-card__actions">
          <Link className="admin-btn admin-btn--small" href={`/adm-cms-hb/gallery/${asset.id}`}>
            Sunting
          </Link>

          <button
            type="button"
            className="admin-btn admin-btn--small"
            disabled={pending || alt === asset.alt}
            onClick={() =>
              startTransition(async () => {
                const form = new FormData();
                form.set("id", asset.id);
                form.set("alt", alt);
                const res = await updateAssetAltAction({}, form);
                setNote(
                  res.error
                    ? { kind: "error", text: res.error }
                    : { kind: "ok", text: res.ok ?? "Tersimpan." },
                );
              })
            }
          >
            Simpan
          </button>

          {/* Form native, bukan pemanggilan action dari onClick: tanpa JS
              tombolnya tetap berfungsi, dan ID action ikut ter-render di HTML
              sehingga bisa diuji dari luar proses. */}
          <form action={deleteAssetAndRedirectAction} className="admin-inline-form">
            <input type="hidden" name="id" value={asset.id} />
            <input type="hidden" name="back" value={backTo} />
            <ConfirmSubmit
              confirm={`Hapus "${asset.filename}"? File di storage juga dihapus dan tidak bisa dikembalikan.`}
              className="admin-btn admin-btn--small admin-btn--ghost"
            >
              Hapus
            </ConfirmSubmit>
          </form>
        </div>

        {note && (
          <p
            className={
              note.kind === "ok" ? "admin-alert admin-alert--ok" : "admin-alert admin-alert--error"
            }
          >
            {note.text}
          </p>
        )}
      </figcaption>
    </figure>
  );
}

function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}