"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";

import { deleteAssetAndRedirectAction, updateAssetAltAction } from "./actions";

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

export function GalleryGrid({ assets }: { assets: Asset[] }) {
  return (
    <div className="admin-media-grid">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  const [alt, setAlt] = useState(asset.alt);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height}` : "—";

  return (
    <figure className="admin-media-card">
      <div className="admin-media-card__thumb">
        <Link href={`/admin/gallery/${asset.id}`} title="Sunting gambar ini">
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
          <Link className="admin-btn admin-btn--small" href={`/admin/gallery/${asset.id}`}>
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