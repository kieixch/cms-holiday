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
type Handle = "move" | "pan" | "scroll-x" | "scroll-y" | "nw" | "ne" | "sw" | "se";

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
  const dragRef = useRef<{
    handle: Handle;
    clientX: number;
    clientY: number;
    rect: Rect;
    pan: { x: number; y: number };
    /** Kotak track scrollbar, hanya dipakai handle `scroll-x` / `scroll-y`. */
    track?: { left: number; top: number; width: number; height: number };
  } | null>(null);

  /**
   * Pointer aktif di area crop, kunci `pointerId`.
   *
   * Dipakai untuk mengenali gesture dua jari (pinch). Pointer Events tidak
   * punya API pinch, jadi jarak antar-pointer dihitung manual.
   */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());

  /**
   * Kondisi awal satu gesture pinch.
   *
   * `scale` dan `pan` disimpan supaya titik tengah jari tetap menempel di
   * bagian gambar yang sama selama zoom — tanpa itu gambar terasa "melompat".
   */
  const pinchRef = useRef<{
    dist: number;
    zoom: number;
    mid: { x: number; y: number };
    scale: number;
    pan: { x: number; y: number };
  } | null>(null);

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

  // Scrollbar tampil hanya saat gambar memang lebih besar dari frame, jadi
  // sekaligus jadi penanda bagian gambar yang tersembunyi.
  const panRangeX = displayW - box.w;
  const panRangeY = displayH - box.h;
  const canPanX = panRangeX > 0.5 && box.w > 0;
  const canPanY = panRangeY > 0.5 && box.h > 0;
  const thumbXFrac = canPanX ? Math.max(0.12, box.w / displayW) : 1;
  const thumbYFrac = canPanY ? Math.max(0.12, box.h / displayH) : 1;
  const progressX = canPanX ? Math.min(1, Math.max(0, -pan.x / panRangeX)) : 0;
  const progressY = canPanY ? Math.min(1, Math.max(0, -pan.y / panRangeY)) : 0;

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
   * Kalau gambar lebih kecil dari frame pada sebuah sumbu, pan sumbu itu
   * dinolkan supaya admin selalu melihat gambar utuh. Menerima ukuran tampilan
   * eksplisit karena pinch mengubah zoom dan pan dalam satu handler, sebelum
   * state `zoom` baru sempat ter-render.
   */
  const clampPanAt = useCallback(
    (next: { x: number; y: number }, width: number, height: number) => ({
      x: width <= box.w ? 0 : Math.min(0, Math.max(box.w - width, next.x)),
      y: height <= box.h ? 0 : Math.min(0, Math.max(box.h - height, next.y)),
    }),
    [box.w, box.h],
  );

  const clampPan = useCallback(
    (next: { x: number; y: number }) => clampPanAt(next, displayW, displayH),
    [clampPanAt, displayW, displayH],
  );

  const clampZoom = useCallback((z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)), []);

  /** Posisi pointer relatif kiri-atas frame. */
  const framePoint = useCallback((clientX: number, clientY: number) => {
    const el = frameRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  const pinchMetrics = useCallback(() => {
    const pts = [...pointersRef.current.values()];
    return {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
      mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
    };
  }, []);

  function startDrag(e: React.PointerEvent, handle: Handle) {
    if (handle !== "pan" && !rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { handle, clientX: e.clientX, clientY: e.clientY, rect: rect ?? { x: 0, y: 0, w: 0, h: 0 }, pan: { ...pan } };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointersRef.current.has(e.pointerId)) {
      const p = framePoint(e.clientX, e.clientY);
      pointersRef.current.set(e.pointerId, p);
    }

    // Pinch: dua jari di area crop mengubah zoom gambar saja, bukan halaman.
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const { dist, mid } = pinchMetrics();
      const nextZoom = clampZoom(pinch.zoom * (dist / Math.max(1, pinch.dist)));
      const nextScale = fitScale * nextZoom;
      const imgX = (pinch.mid.x - pinch.pan.x) / pinch.scale;
      const imgY = (pinch.mid.y - pinch.pan.y) / pinch.scale;
      setZoom(nextZoom);
      setPan(
        clampPanAt(
          { x: mid.x - imgX * nextScale, y: mid.y - imgY * nextScale },
          viewW * nextScale,
          viewH * nextScale,
        ),
      );
      return;
    }

    const drag = dragRef.current;
    if (!drag || scale <= 0) return;

    if (drag.handle === "pan") {
      setPan(
        clampPan({
          x: drag.pan.x + (e.clientX - drag.clientX),
          y: drag.pan.y + (e.clientY - drag.clientY),
        }),
      );
      return;
    }

    if (drag.handle === "scroll-x" || drag.handle === "scroll-y") {
      applyScroll(drag, e.clientX, e.clientY);
      return;
    }

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

  /**
   * Terapkan posisi pan dari sentuhan pada track scrollbar.
   *
   * Posisi jari dipetakan 0..1 sepanjang track ke 0..selisih(display, frame),
   * jadi scrollbar selalu mewakili seluruh gambar.
   */
  function applyScroll(
    drag: NonNullable<typeof dragRef.current>,
    clientX: number,
    clientY: number,
  ) {
    const track = drag.track;
    if (!track) return;
    const ratio = (value: number, start: number, length: number) =>
      length <= 0 ? 0 : Math.min(1, Math.max(0, (value - start) / length));

    if (drag.handle === "scroll-x") {
      const hidden = displayW - box.w;
      if (hidden <= 0) return;
      setPan(clampPan({ ...drag.pan, x: -ratio(clientX, track.left, track.width) * hidden }));
    } else {
      const hidden = displayH - box.h;
      if (hidden <= 0) return;
      setPan(clampPan({ ...drag.pan, y: -ratio(clientY, track.top, track.height) * hidden }));
    }
  }

  function startScroll(e: React.PointerEvent, axis: "x" | "y") {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const drag = {
      handle: axis === "x" ? ("scroll-x" as const) : ("scroll-y" as const),
      clientX: e.clientX,
      clientY: e.clientY,
      rect: rect ?? { x: 0, y: 0, w: 0, h: 0 },
      pan: { ...pan },
      track: { left: r.left, top: r.top, width: r.width, height: r.height },
    };
    dragRef.current = drag;
    applyScroll(drag, e.clientX, e.clientY);
  }

  /** Zoom dari tombol, berpusat di tengah frame supaya gambar tidak "kabur". */
  function zoomBy(factor: number) {
    const nextZoom = clampZoom(zoom * factor);
    if (nextZoom === zoom) return;
    const nextScale = fitScale * nextZoom;
    const mid = { x: box.w / 2, y: box.h / 2 };
    const imgX = (mid.x - pan.x) / scale;
    const imgY = (mid.y - pan.y) / scale;
    setZoom(nextZoom);
    setPan(
      clampPanAt(
        { x: mid.x - imgX * nextScale, y: mid.y - imgY * nextScale },
        viewW * nextScale,
        viewH * nextScale,
      ),
    );
  }

  function rotateBy(delta: number) {
    if (!rotatable) return;
    setRotation((r) => (r + delta + 360) % 360);
    // Rotasi menukar lebar/tinggi tampilan; memindahkan pan lama ke sumbu baru
    // membuat gambar tampak terpotong, jadi tampilan dikembalikan ke tengah.
    setPan({ x: 0, y: 0 });
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
    pointersRef.current.set(e.pointerId, framePoint(e.clientX, e.clientY));

    // Jari kedua memulai pinch: batalkan drag kotak/pan supaya tidak berebut
    // memperlakukan pointer yang sama.
    if (pointersRef.current.size === 2) {
      const { dist, mid } = pinchMetrics();
      dragRef.current = null;
      pinchRef.current = { dist, zoom, mid, scale, pan: { ...pan } };
      return;
    }
    if (pointersRef.current.size > 2) return;

    // Drag di area luar kotak crop = menggeser gambar, berguna saat zoom besar
    // atau saat menjangkau bagian gambar yang tertutup kotak.
    if ((e.target as HTMLElement).closest(".admin-crop__scrollbar")) return;
    if ((e.target as HTMLElement).closest(".admin-crop__box")) return;
    startDrag(e, "pan");
  }

  function onFramePointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    endDrag();
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
      router.push(`/adm-cms-hb/gallery/${payload.asset.id}?tersimpan=suntingan`);
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
            onClick={() => zoomBy(1 / 1.25)}
            aria-label="Perkecil tampilan"
          >
            −
          </button>
          <span className="admin-crop__zoom">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="admin-btn admin-btn--small admin-btn--ghost"
            onClick={() => zoomBy(1.25)}
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
        id="crop-viewport"
        ref={frameRef}
        onPointerDown={onFramePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onFramePointerUp}
        onPointerCancel={onFramePointerUp}
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
              position: "absolute",
              left: "50%",
              top: "50%",
              width: `${naturalW * scale}px`,
              height: `${naturalH * scale}px`,
              // Dipusatkan dulu, baru diputar: tanpa `translate(-50%, -50%)`
              // gambar 90°/270° (yang menukar lebar/tinggi canvas) meleset
              // keluar canvas dan tampak terpotong.
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
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
            onPointerDown={(e) => {
              // Pointerdown pada handle ikut mem-bubble ke kotak; tanpa cek ini
              // drag "move" kotak selalu menimpa resize sudut.
              if ((e.target as HTMLElement).closest(".admin-crop__handle")) return;
              startDrag(e, "move");
            }}
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

        {canPanY ? (
          <div
            className="admin-crop__scrollbar admin-crop__scrollbar--y"
            role="scrollbar"
            aria-label="Geser tampilan atas-bawah"
            aria-orientation="vertical"
            aria-controls="crop-viewport"
            aria-valuenow={Math.round(progressY * 100)}
            onPointerDown={(e) => startScroll(e, "y")}
          >
            <span
              className="admin-crop__thumb"
              style={{
                height: `${thumbYFrac * 100}%`,
                top: `${progressY * (1 - thumbYFrac) * 100}%`,
              }}
            />
          </div>
        ) : null}

        {canPanX ? (
          <div
            className="admin-crop__scrollbar admin-crop__scrollbar--x"
            role="scrollbar"
            aria-label="Geser tampilan kiri-kanan"
            aria-orientation="horizontal"
            aria-controls="crop-viewport"
            aria-valuenow={Math.round(progressX * 100)}
            onPointerDown={(e) => startScroll(e, "x")}
          >
            <span
              className="admin-crop__thumb"
              style={{
                width: `${thumbXFrac * 100}%`,
                left: `${progressX * (1 - thumbXFrac) * 100}%`,
              }}
            />
          </div>
        ) : null}
      </div>

      <p className="admin-crop__readout">
        Dipotong {Math.round(rect!.w)}×{Math.round(rect!.h)} px dari {naturalW}×{naturalH}
        {rotation !== 0 ? ` · diputar ${rotation}°` : ""}
      </p>

      <div className="admin-form__footer">
        <button className="admin-btn admin-btn--primary" onClick={save} disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan hasil suntingan"}
        </button>
        <Link className="admin-btn admin-btn--ghost" href="/adm-cms-hb/gallery">
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