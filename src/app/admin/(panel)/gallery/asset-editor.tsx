"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type EditorAsset = {
  id: string;
  filename: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  folder: string;
};

export type EditorActions = {
  meta: (form: FormData) => Promise<void>;
  rename: (form: FormData) => Promise<void>;
};

/** Rasio pilihan admin. `ratio: 0` berarti bebas, tanpa penguncian sisi. */
const ASPECTS = [
  { key: "free", label: "Bebas", ratio: 0 },
  { key: "1-1", label: "1:1", ratio: 1 },
  { key: "4-3", label: "4:3", ratio: 4 / 3 },
  { key: "3-2", label: "3:2", ratio: 3 / 2 },
  { key: "16-9", label: "16:9", ratio: 16 / 9 },
] as const;

type AspectKey = (typeof ASPECTS)[number]["key"];

/** Batas zoom supaya gambar tidak mengecil sampai tak berguna atau pecah. */
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "move" | "nw" | "ne" | "sw" | "se";

export function AssetEditor({
  asset,
  actions,
  cropEditable,
}: {
  asset: EditorAsset;
  actions: EditorActions;
  /** False untuk URL impor lama yang filenya tidak ada di storage kita. */
  cropEditable: boolean;
}) {
  return (
    <div className="admin-editor">
      <div className="admin-editor__side">
        <MetaForm
          asset={asset}
          action={actions.meta}
          title="Teks alternatif & folder"
          note="Alt dipakai untuk aksesibilitas dan jadi teks bantu saat gambar gagal dimuat."
          rows={["alt", "folder"]}
        />
        <MetaForm
          asset={asset}
          action={actions.rename}
          title="Nama file"
          note="Hanya label tampilan di galeri dan picker. URL serta file di storage tidak berubah."
          rows={["filename"]}
        />
      </div>

      {cropEditable ? <CropEditor asset={asset} /> : null}
    </div>
  );
}

/**
 * Form metadata satu aset.
 *
 * Native `<form action>` dengan uncontrolled input, bukan `useActionState`.
 * Alasannya nyata: metadata ini wajib bisa disimpan even ketika crop editor
 * gagal dimuat atau JavaScript tidak tersedia, dan HTML-nya bisa diuji dari
 * luar proses. Server action yang dipakai sudah mengarahkan balik ke halaman
 * aset dengan pesan di query param.
 */
function MetaForm({
  asset,
  action,
  title,
  note,
  rows,
}: {
  asset: EditorAsset;
  action: (form: FormData) => Promise<void>;
  title: string;
  note: string;
  rows: Array<"alt" | "folder" | "filename">;
}) {
  return (
    <form action={action} className="admin-card">
      <input type="hidden" name="id" value={asset.id} />

      <h2>{title}</h2>
      <p className="admin-hint">{note}</p>

      {rows.includes("alt") ? (
        <label className="admin-field">
          <span className="admin-field__label">Teks alternatif</span>
          <textarea
            className="admin-textarea"
            name="alt"
            rows={3}
            defaultValue={asset.alt}
            placeholder="Deskripsi singkat isi foto"
          />
        </label>
      ) : null}

      {rows.includes("folder") ? (
        <label className="admin-field">
          <span className="admin-field__label">Folder</span>
          <input
            name="folder"
            defaultValue={asset.folder}
            placeholder="mis. pkt-banyuwangi/2026"
          />
        </label>
      ) : null}

      {rows.includes("filename") ? (
        <label className="admin-field">
          <span className="admin-field__label">Nama file</span>
          <input name="filename" defaultValue={asset.filename} />
        </label>
      ) : null}

      <div className="admin-form__footer">
        <button className="admin-btn admin-btn--primary">Simpan</button>
      </div>
    </form>
  );
}

/**
 * Editor crop: tarik kotak, putar, dan zoom.
 *
 * Kotak crop disimpan dalam koordinat gambar ASLI, bukan piksel layar. Dengan
 * begitu zoom dan geser hanya mengubah tampilan — kotak yang terkirim ke
 * server tetap sama. Server memetakannya ke ruang gambar yang sudah diputar
 * (lihat `rotateCropRect`), jadi client cukup mengirim kotak dalam ruang yang
 * terlihat beserta sudut putarnya.
 */
function CropEditor({ asset }: { asset: EditorAsset }) {
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ handle: Handle; clientX: number; clientY: number; rect: Rect } | null>(
    null,
  );

  const naturalW = asset.width ?? 0;
  const naturalH = asset.height ?? 0;
  const rotatable = naturalW > 0 && naturalH > 0;

  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [aspect, setAspect] = useState<AspectKey>("free");
  const [rect, setRect] = useState<Rect | null>(
    rotatable ? { x: 0, y: 0, w: naturalW, h: naturalH } : null,
  );
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Sisi gambar yang terlihat setelah diputar. Putar 90 dan 270 menukarnya.
  const swapped = rotation === 90 || rotation === 270;
  const viewW = swapped ? naturalH : naturalW;
  const viewH = swapped ? naturalW : naturalH;

  /** Skala yang membuat gambar pas di frame saat zoom = 1. */
  const fitScale = box.w > 0 && viewW > 0 ? Math.min(box.w / viewW, box.h / viewH) : 1;
  const scale = fitScale * zoom;
  const displayW = viewW * scale;
  const displayH = viewH * scale;

  // Ukuran frame dibaca lewat ResizeObserver supaya editor ikut benar saat
  // jendela diubah atau panel admin menyempit di layar kecil.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clamp = useCallback(
    (next: Rect): Rect => {
      const w = Math.max(1, Math.min(next.w, viewW));
      const h = Math.max(1, Math.min(next.h, viewH));
      return {
        w,
        h,
        x: Math.max(0, Math.min(next.x, viewW - w)),
        y: Math.max(0, Math.min(next.y, viewH - h)),
      };
    },
    [viewW, viewH],
  );

  /**
   * Geser gambar supaya bagian yang tidak tertutup frame tidak bisa dibuka.
   *
   * Kalau gambar lebih kecil dari frame, pan dinolkan supaya admin selalu
   * melihat gambar utuh.
   */
  const clampPan = useCallback(
    (next: { x: number; y: number }) => ({
      x: displayW <= box.w ? 0 : Math.min(0, Math.max(box.w - displayW, next.x)),
      y: displayH <= box.h ? 0 : Math.min(0, Math.max(box.h - displayH, next.y)),
    }),
    [box.w, box.h, displayW, displayH],
  );

  function startDrag(e: React.PointerEvent, handle: Handle) {
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { handle, clientX: e.clientX, clientY: e.clientY, rect };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || scale <= 0) return;

    // Delta layar -> piksel gambar asli, jadi kecepatan drag tidak ikut
    // berubah oleh zoom.
    const dx = (e.clientX - drag.clientX) / scale;
    const dy = (e.clientY - drag.clientY) / scale;
    const r = drag.rect;

    if (drag.handle === "move") {
      setRect(clamp({ ...r, x: r.x + dx, y: r.y + dy }));
      return;
    }

    const west = drag.handle.includes("w");
    const north = drag.handle.includes("n");

    const next: Rect = {
      x: west ? r.x + dx : r.x,
      y: north ? r.y + dy : r.y,
      w: west ? r.w - dx : r.w + dx,
      h: north ? r.h - dy : r.h + dy,
    };

    // Rasio dikunci dari sisi horizontal: setiap sudut punya lebar yang jelas
    // (kiri-atas dan kanan-bawah menambah, dua sudut lain mengurangi), jadi
    // kotak tidak pernah ikut terbalik atau berubah jadi negatif.
    const ratio = ASPECTS.find((a) => a.key === aspect)?.ratio ?? 0;
    if (ratio > 0) next.h = next.w / ratio;

    setRect(clamp(next));
  }

  function endDrag() {
    dragRef.current = null;
  }

  function rotateBy(delta: number) {
    if (!rotatable) return;
    setRotation((r) => (r + delta + 360) % 360);
    setPan((p) => ({ x: -p.y, y: p.x }));
  }

  function chooseAspect(key: AspectKey) {
    setAspect(key);
    const ratio = ASPECTS.find((a) => a.key === key)?.ratio ?? 0;
    if (!rect || ratio <= 0) return;
    // Preset diperlakukan sebagai "bingkai": kotak terbesar dengan rasio itu
    // yang muat di posisi sekarang, bukan mengubah ukuran secara acak.
    const next =
      rect.w / rect.h > ratio ? { ...rect, w: rect.h * ratio } : { ...rect, h: rect.w / ratio };
    setRect(clamp(next));
  }

  function reset() {
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setAspect("free");
    setRect(rotatable ? { x: 0, y: 0, w: naturalW, h: naturalH } : null);
    setNote(null);
  }

  function onFramePointerDown(e: React.PointerEvent) {
    // Drag di area kosong = menggeser gambar, berguna saat zoom sudah besar.
    if ((e.target as HTMLElement).closest(".admin-crop__box")) return;
    if (displayW <= box.w && displayH <= box.h) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const origin = { x: e.clientX, y: e.clientY, pan };
    const move = (ev: PointerEvent) => {
      setPan(
        clampPan({
          x: origin.pan.x + (ev.clientX - origin.x),
          y: origin.pan.y + (ev.clientY - origin.y),
        }),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function save() {
    if (!rect) return;
    setBusy(true);
    setNote(null);

    try {
      const res = await fetch(`/api/admin/gallery/${asset.id}/crop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.w),
          h: Math.round(rect.h),
          rotation,
          alt: asset.alt,
          folder: asset.folder,
        }),
      });

      const payload = (await res.json()) as { asset?: { id: string }; error?: string };

      if (!res.ok || !payload.asset) {
        setNote({ kind: "error", text: payload.error ?? "Gagal menyimpan hasil suntingan." });
        return;
      }

      // Hasil suntingan adalah aset BARU, jadi admin diarahkan ke halaman
      // hasilnya. URL lama tetap hidup dan tidak ada yang rusak.
      router.push(`/admin/gallery/${payload.asset.id}?tersimpan=suntingan`);
      router.refresh();
    } catch {
      setNote({ kind: "error", text: "Gagal menghubungi server." });
    } finally {
      setBusy(false);
    }
  }

  if (!rotatable) {
    return (
      <div className="admin-card">
        <h2>Crop &amp; putar</h2>
        <p className="admin-hint">
          Dimensi gambar ini belum diketahui, jadi kotak crop tidak bisa dihitung. Unggah ulang
          gambarnya untuk memakai editor.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <h2>Crop &amp; putar</h2>
      <p className="admin-hint">
        Hasil suntingan disimpan sebagai gambar BARU di galeri. File asli, URL lama, dan semua
        pemakaiannya tetap utuh.
      </p>

      <div className="admin-crop__toolbar">
        <div className="admin-crop__group">
          {ASPECTS.map((a) => (
            <button
              key={a.key}
              type="button"
              className={
                aspect === a.key
                  ? "admin-btn admin-btn--small admin-btn--primary"
                  : "admin-btn admin-btn--small admin-btn--ghost"
              }
              onClick={() => chooseAspect(a.key)}
              aria-pressed={aspect === a.key}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="admin-crop__group">
          <button
            type="button"
            className="admin-btn admin-btn--small"
            onClick={() => rotateBy(-90)}
            aria-label="Putar 90 derajat ke kiri"
          >
            ↺
          </button>
          <span className="admin-crop__angle">{rotation}°</span>
          <button
            type="button"
            className="admin-btn admin-btn--small"
            onClick={() => rotateBy(90)}
            aria-label="Putar 90 derajat ke kanan"
          >
            ↻
          </button>
        </div>

        <div className="admin-crop__group">
          <button
            type="button"
            className="admin-btn admin-btn--small admin-btn--ghost"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))}
            aria-label="Perkecil tampilan"
          >
            −
          </button>
          <span className="admin-crop__zoom">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="admin-btn admin-btn--small admin-btn--ghost"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}
            aria-label="Perbesar tampilan"
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--small admin-btn--ghost"
          onClick={reset}
        >
          Atur ulang
        </button>
      </div>

      <div
        className="admin-crop__frame"
        ref={frameRef}
        onPointerDown={onFramePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="admin-crop__canvas"
          style={{
            width: `${displayW}px`,
            height: `${displayH}px`,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <Image
            src={asset.url}
            alt={asset.alt || asset.filename}
            width={naturalW}
            height={naturalH}
            unoptimized
            style={{
              width: `${naturalW * scale}px`,
              height: `${naturalH * scale}px`,
              transform: `rotate(${rotation}deg)`,
            }}
          />

          <div
            className="admin-crop__box"
            role="group"
            aria-label="Kotak crop"
            style={{
              left: `${rect!.x * scale}px`,
              top: `${rect!.y * scale}px`,
              width: `${rect!.w * scale}px`,
              height: `${rect!.h * scale}px`,
            }}
            onPointerDown={(e) => startDrag(e, "move")}
          >
            {(["nw", "ne", "sw", "se"] as const).map((corner) => (
              <span
                key={corner}
                className={`admin-crop__handle admin-crop__handle--${corner}`}
                onPointerDown={(e) => startDrag(e, corner)}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="admin-crop__readout">
        Dipotong {Math.round(rect!.w)}×{Math.round(rect!.h)} px dari {naturalW}×{naturalH}
        {rotation !== 0 ? ` · diputar ${rotation}°` : ""}
      </p>

      <div className="admin-form__footer">
        <button className="admin-btn admin-btn--primary" onClick={save} disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan hasil suntingan"}
        </button>
        <Link className="admin-btn admin-btn--ghost" href="/admin/gallery">
          Kembali ke galeri
        </Link>
      </div>

      {note ? (
        <p
          className={note.kind === "ok" ? "admin-notice" : "admin-error"}
          role={note.kind === "error" ? "alert" : "status"}
        >
          {note.text}
        </p>
      ) : null}
    </div>
  );
}