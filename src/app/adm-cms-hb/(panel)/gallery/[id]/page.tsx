import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { findImageUsage } from "@/lib/admin/gallery-usage";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { managedKeyFromUrl } from "@/lib/image";

import {
  deleteAssetAndRedirectAction,
  renameAssetAction,
  updateAssetMetaAction,
} from "../actions";
import { AssetEditor } from "../asset-editor";

export const metadata: Metadata = { title: "Sunting gambar — Admin" };

/**
 * Detail satu aset: metadata, crop, dan jejak provenance.
 *
 * `force-dynamic` karena halaman ini menampilkan data yang selalu berubah —
 * jumlah turunan, jumlah pemakaian, dan status storage. Tidak ada yang bisa
 * di-cache di sini.
 */
export const dynamic = "force-dynamic";

export default async function AssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tersimpan?: string; galat?: string }>;
}) {
  await requireSessionUser();

  const { id } = await params;
  const { tersimpan, galat } = await searchParams;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      derivedFrom: { select: { id: true, filename: true, url: true } },
      derivations: {
        select: { id: true, filename: true, url: true, width: true, height: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!asset) notFound();

  const usage = await findImageUsage(asset.url);

  // Aset hasil impor lama menunjuk ke host luar, jadi file-nya tidak ada di
  // storage kita. Crop membaca file dari storage, jadi untuk URL seperti ini
  // editor harus dimatikan dan alasannya dijelaskan, bukan diam-diam gagal.
  const storageKey = managedKeyFromUrl(asset.url);

  return (
    <>
      <header className="admin-page-head">
        <div>
          <Link className="admin-backlink" href="/adm-cms-hb/gallery">
            ← Galeri
          </Link>
          <h1>{asset.filename}</h1>
          <p className="admin-head__sub">
            {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"} ·{" "}
            {kb(asset.size)} · {asset.mime} · folder {asset.folder}
          </p>
        </div>
      </header>

      {galat ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {galat}
        </p>
      ) : null}

      {tersimpan === "suntingan" ? (
        <p className="admin-notice" role="status">
          Hasil suntingan tersimpan sebagai gambar baru. Gambar asal masih ada di galeri.
        </p>
      ) : null}

      {tersimpan === "meta" ? (
        <p className="admin-notice" role="status">
          Teks alternatif dan folder disimpan.
        </p>
      ) : null}

      {tersimpan === "nama" ? (
        <p className="admin-notice" role="status">
          Nama file disimpan.
        </p>
      ) : null}

      {!storageKey ? (
        <p className="admin-alert admin-alert--error">
          Gambar ini berasal dari impor lama dan filenya tidak ada di storage kita, jadi tidak
          bisa dicrop atau diputar di sini. Alt dan folder tetap bisa diperbaiki di bawah.
        </p>
      ) : null}

      <AssetEditor
        asset={{
          id: asset.id,
          filename: asset.filename,
          url: asset.url,
          mime: asset.mime,
          size: asset.size,
          width: asset.width,
          height: asset.height,
          alt: asset.alt,
          folder: asset.folder,
        }}
        actions={{ meta: updateAssetMetaAction, rename: renameAssetAction }}
        cropEditable={Boolean(storageKey)}
      />

      <section className="admin-card">
        <h2>Jejak suntingan</h2>
        <p className="admin-hint">
          Setiap hasil suntingan adalah gambar baru yang menunjuk ke asalnya. Asal tidak bisa
          dihapus selama masih punya turunan, supaya jejaknya tidak putus.
        </p>

        {asset.derivedFrom ? (
          <p className="admin-list__meta">
            Asal-usul:{" "}
            <Link href={`/adm-cms-hb/gallery/${asset.derivedFrom.id}`}>
              {asset.derivedFrom.filename}
            </Link>
          </p>
        ) : (
          <p className="admin-list__meta">Gambar asli, bukan hasil suntingan.</p>
        )}

        {asset.derivations.length === 0 ? (
          <p className="admin-list__meta">Belum ada hasil suntingan dari gambar ini.</p>
        ) : (
          <ul className="admin-list">
            {asset.derivations.map((child) => (
              <li key={child.id} className="admin-list__row">
                <div className="admin-list__main">
                  <Link className="admin-list__title" href={`/adm-cms-hb/gallery/${child.id}`}>
                    {child.filename}
                  </Link>
                  <p className="admin-list__meta">
                    {child.width && child.height ? `${child.width}×${child.height}` : "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-card">
        <h2>Dipakai di</h2>
        {usage.count === 0 ? (
          <p className="admin-list__meta">
            Belum dipakai di paket atau galeri paket mana pun, jadi aman dihapus.
          </p>
        ) : (
          <ul className="admin-list">
            {usage.places.map((place) => (
              <li key={place.href} className="admin-list__row">
                <div className="admin-list__main">
                  <Link className="admin-list__title" href={place.href}>
                    {place.where}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={deleteAssetAndRedirectAction} className="admin-danger-zone">
        <h2>Hapus gambar</h2>
        <p className="admin-hint">
          File di storage ikut terhapus dan tidak bisa dikembalikan. Aset yang masih dipakai di
          paket atau yang punya hasil suntingan akan ditolak.
        </p>
        <input type="hidden" name="id" value={asset.id} />
        <ConfirmSubmit confirm={`Hapus "${asset.filename}" beserta file di storage?`}>
          Hapus gambar
        </ConfirmSubmit>
      </form>
    </>
  );
}

function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}