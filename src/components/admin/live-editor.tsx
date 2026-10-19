"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

import { PublicShell } from "@/components/site/public-shell";
import {
  CategoryBody,
  HomeBody,
  PackageBody,
  type CategoryBodyData,
  type HomeBodyProps,
  type SectionWrap,
} from "@/components/site/views";
import type { HtmlPagePreviewBase, PreviewBase, BioPreviewBase } from "@/lib/admin/preview-base";

import { BioLinkPage } from "@/components/site/bio-link-page";
import { PackageCard } from "@/components/site/package-card";
import { TypeCardGrid } from "@/components/site/home-blocks";

import {
  bioPreview,
  categoryPreview,
  categoryTypeCard,
  homePreview,
  homeSettingsPreview,
  htmlPagePreview,
  packageCardPreview,
  packagePreview,
} from "@/lib/admin/preview-data";
import type { PackagePreviewData } from "@/lib/admin/package-detail-links";
import type { FieldSection } from "@/lib/admin/sections";

import { FormFields, type ErrorMap, type FormValues } from "./form-fields";
import { HalamanCardPreview, HalamanDocPreview } from "./halaman-preview";
import type { FormState } from "./admin-form";

/** Bentuk nilai form yang dikirim ke `<LiveEditor>`. */
export type Action = (prevState: FormState, formData: FormData) => Promise<FormState>;

/**
 * Batas zum pratinjau. `zoom` (bukan `transform: scale`) yang dipakai supaya
 * tata letak tetap dirender pada ukuran aslinya lalu diperkecil/diperbesar
 * secara visual — sama seperti perilaku zum peramban. Ini yang membuat seluruh
 * halaman (yang di mode desktop `min-width: 68rem`) bisa dilihat utuh tanpa
 * menggulir mendatar.
 */
const PREVIEW_ZOOM_MIN = 0.25;
const PREVIEW_ZOOM_MAX = 2;
const PREVIEW_ZOOM_STEP = 0.25;

function clampPreviewZoom(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, rounded));
}

/**
 * Apa yang dirender di kolom kanan.
 *
 * `base` adalah data hasil query server, jadi preview punya isi yang benar
 * sejak form dibuka. Nilai `values` yang diketik user menimpanya per field —
 * makanya preview bisa berubah tanpa menyentuh database.
 *
 * `shell` membawa kerangka halaman publik: variant CSS, menu, footer, dan nomor
 * WhatsApp. Wajib ada karena seluruh `legacy.css` berada di bawah `.hb2d1n`,
 * jadi tanpa wrapper itu preview memakai komponen yang benar tetapi tampil
 * tanpa desain sama sekali.
 *
 * `kind` tetap discriminated union supaya `base` ikut menyempit otomatis —
 * kalau digabung jadi satu tipe, tiap `renderPreview` harus meng-cast sendiri
 * dan salah pilih tidak akan caught oleh TypeScript.
 */
export type PreviewSpec =
  | ({ kind: "category" } & PreviewBase<CategoryBodyData>)
  | ({ kind: "package" } & PreviewBase<PackagePreviewData>)
  | ({ kind: "home" } & PreviewBase<HomeBodyProps>)
  | ({ kind: "htmlpage" } & PreviewBase<HtmlPagePreviewBase>)
  | ({ kind: "doc" } & PreviewBase<HtmlPagePreviewBase>)
  | ({ kind: "bio" } & BioPreviewBase);

type Props = {
  sections: FieldSection[];
  /** Nilai awal: record dari DB saat edit, atau `{}` saat membuat baru. */
  initial?: FormValues;
  action: Action;
  title: string;
  preview: PreviewSpec;
  submitLabel?: string;
  backHref?: string;
  backLabel?: string;
  hidden?: Record<string, string>;
};

/**
 * Editor dua kolom: daftar field bernomor di kiri, live preview di kanan.
 *
 * Dua hal yang dijaga di sini:
 *
 *   1. **Preview memakai komponen publik yang sama** (`<CategoryBody>`,
 *      `<PackageBody>`, `<HomeBody>`). Kalau preview dirender dengan komponen
 *      sendiri, hasilnya pasti menyimpang dari halaman asli dan perbedaan
 *      sekecil `object-cover` baru ketahuan waktu audit gagal.
 *   2. **Draft tidak pernah tersimpan diam-diam.** Nilai ada di state client;
 *      hanya tombol Simpan yang memanggil server action.
 *
 * Klik salah satu section di preview akan membuka group field yang
 * mengaturnya lalu menggulir ke sana. Ini membuat spec `FieldSection.id`
 * menjadi kontrak antara editor dan halaman publik — kalau berubah di satu
 * sisi, pemetaannya ikut bergeser di sisi lain.
 */
export function LiveEditor({
  sections,
  initial,
  action,
  title,
  preview,
  submitLabel = "Simpan",
  backHref,
  backLabel = "Kembali",
  hidden,
}: Props) {
  const [values, setValues] = useState<FormValues>(() => ({ ...initial }));
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [open, setOpen] = useState<string[]>(() => [sections[0]?.id].filter(Boolean) as string[]);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const errors = state?.errors ?? {};

  const zoomIn = useCallback(
    () => setZoom((z) => clampPreviewZoom(z + PREVIEW_ZOOM_STEP)),
    [],
  );
  const zoomOut = useCallback(
    () => setZoom((z) => clampPreviewZoom(z - PREVIEW_ZOOM_STEP)),
    [],
  );
  const zoomReset = useCallback(() => setZoom(1), []);

  /**
   * "Fit": hitung ulang zum agar lebar halaman pas di kolom pratinjau.
   *
   * Lebar alami diukur dengan menetralkan `zoom` sesaat (tulis-lalu-baca
   * sinkron), jadi hasilnya benar apa pun nilai zum saat ini dan apa pun
   * dukungan peramban terhadap `zoom`.
   */
  const zoomFit = useCallback(() => {
    const frame = frameRef.current;
    const surface = surfaceRef.current;
    if (!frame || !surface) return;
    const previous = surface.style.zoom;
    surface.style.zoom = "1";
    const natural = surface.getBoundingClientRect().width;
    surface.style.zoom = previous;
    const style = getComputedStyle(frame);
    const inner =
      frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (natural <= 0 || inner <= 0) return;
    setZoom(clampPreviewZoom(inner / natural));
  }, []);

  /** Saat layar penuh: kunci gulir latar dan izinkan keluar dengan Escape. */
  useEffect(() => {
    if (!full) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [full]);

  const setValue = useCallback(
    (name: string, value: unknown) =>
      setValues((prev) => (Object.is(prev[name], value) ? prev : { ...prev, [name]: value })),
    [],
  );

  const toggle = useCallback((id: string) => {
    setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setFocused(null);
  }, []);

  /** Dipakai section di preview untuk membuka group field yang mengaturnya. */
  const focusSection = useCallback((id: string) => {
    setOpen((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setFocused(id);
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(`[data-section-panel="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const wrap = useCallback<SectionWrap>(
    (section, node) => (
      <PreviewSection
        section={section}
        active={focused === section}
        onSelect={() => focusSection(section)}
      >
        {node}
      </PreviewSection>
    ),
    [focused, focusSection],
  );

  /**
   * Preview memakai `<PublicShell>` sungguhan, jadi seluruh tautannya hidup.
   * Di panel, tautan itu tidak boleh bernavigasi: klik pada menu, kartu, atau
   * logo akan membuang draft yang belum disimpan.
   *
   * Penjagaan dipasang di fase **capture**, bukan bubble. Next `<Link>`
   * menangani klik pada elemen anchor lalu langsung `router.push()`; kalau
   * `preventDefault()` baru dipasang saat event bubble ke permukaan preview,
   * navigasi sudah terlanjur jalan. Dengan capture, `defaultPrevented` sudah
   * terpasang sebelum handler `Link` berjalan, sehingga `Link` berhenti sendiri
   * (ia memeriksa `e.defaultPrevented` di awal) dan anchor `href` biasa juga
   * tidak jadi dieksekusi.
   *
   * `stopPropagation` sengaja tidak dipakai supaya klik tetap sampai ke
   * handler section (`PreviewSection`) — bagian di preview masih perlu bisa
   * diklik untuk melompat ke field yang mengaturnya.
   */
  const blockNavigation = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement | null)?.closest("a");
    if (anchor) event.preventDefault();
  }, []);

  /**
   * Nomor urut field, sesuai urutan tampil di panel kiri.
   *
   * Repeater ikut diberi nomor: daftarnya tetap jadi rujukan saat mengisi
   * paket yang punya banyak baris (itinerary, harga, galeri), jadi nomor tidak
   * boleh melompati sebagian field. Field anak di dalam repeater tidak diberi
   * nomor — jumlahnya berubah-ubah mengikuti isi tiap baris.
   */
  const numbers = useMemo(() => {
    const map: Record<string, number> = {};
    let index = 0;
    for (const section of sections) {
      for (const field of section.fields) {
        index += 1;
        map[field.name] = index;
      }
    }
    return map;
  }, [sections]);

  const errorList = Object.entries(errors);

  return (
    <form action={formAction} className="live-editor" noValidate>
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}

      <aside className="live-editor__panel" ref={panelRef}>
        <header className="admin-page-head">
          <div>
            {backHref ? (
              <Link className="admin-backlink" href={backHref}>
                ← {backLabel}
              </Link>
            ) : null}
            <h1>{title}</h1>
          </div>
          <SubmitButton pending={pending} label={submitLabel} />
        </header>

        {state?.message ? (
          <p className="admin-error" role="alert">
            {state.message}
          </p>
        ) : null}

        {errorList.length > 0 ? (
          <div className="admin-error-summary" role="alert">
            <strong>{errorList.length} kolom perlu diperbaiki:</strong>
            <ul>
              {errorList.slice(0, 8).map(([fieldPath, msg]) => (
                <li key={fieldPath}>
                  <code>{fieldPath}</code> — {msg}
                </li>
              ))}
              {errorList.length > 8 ? <li>…dan {errorList.length - 8} lainnya.</li> : null}
            </ul>
          </div>
        ) : null}

        <p className="live-editor__hint">
          Klik judul bagian untuk membuka atau minimize field-nya. Klik bagian di preview untuk
          melompat ke field yang mengaturnya.
        </p>

        <div className="live-editor__sections">
          {sections.map((section, index) => (
            <LiveAccordion
              key={section.id}
              section={section}
              index={index}
              isOpen={open.includes(section.id)}
              isFocused={focused === section.id}
              values={values}
              errors={errors}
              numbers={numbers}
              onToggle={toggle}
              onChange={setValue}
            />
          ))}
        </div>

        <footer className="admin-form__footer">
          <SubmitButton pending={pending} label={submitLabel} />
          {backHref ? (
            <Link className="admin-btn admin-btn--ghost" href={backHref}>
              Batal
            </Link>
          ) : null}
        </footer>
      </aside>

      <div className={`live-editor__preview${full ? " is-full" : ""}`}>
        <div className="live-preview__bar">
          <span className="live-preview__badge">Pratinjau · belum disimpan</span>
          <div className="live-preview__tools">
            <div className="live-preview__zoom" role="group" aria-label="Zum pratinjau">
              <button
                type="button"
                onClick={zoomOut}
                disabled={zoom <= PREVIEW_ZOOM_MIN}
                aria-label="Perkecil pratinjau"
                title="Perkecil"
              >
                −
              </button>
              <button
                type="button"
                className="live-preview__zoomval"
                onClick={zoomReset}
                title="Kembalikan ke 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={zoomIn}
                disabled={zoom >= PREVIEW_ZOOM_MAX}
                aria-label="Perbesar pratinjau"
                title="Perbesar"
              >
                +
              </button>
              <button
                type="button"
                className="live-preview__zoomfit"
                onClick={zoomFit}
                title="Sesuaikan lebar halaman dengan kolom pratinjau"
              >
                Fit
              </button>
            </div>
            <div className="live-preview__devices">
              <button
                type="button"
                className={device === "desktop" ? "is-active" : ""}
                onClick={() => setDevice("desktop")}
              >
                Desktop
              </button>
              <button
                type="button"
                className={device === "mobile" ? "is-active" : ""}
                onClick={() => setDevice("mobile")}
              >
                Ponsel
              </button>
            </div>
            <button
              type="button"
              className={`live-preview__fullbtn${full ? " is-active" : ""}`}
              onClick={() => setFull((value) => !value)}
              title={full ? "Keluar dari layar penuh (Esc)" : "Tampilkan pratinjau selayar penuh"}
            >
              {full ? "Keluar" : "Layar penuh"}
            </button>
          </div>
        </div>
        <div className={`live-preview__frame is-${device}`} ref={frameRef}>
          <div
            className="live-preview__surface"
            ref={surfaceRef}
            style={{ zoom }}
            onClickCapture={blockNavigation}
            onAuxClickCapture={blockNavigation}
          >
            {renderPreview(preview, values, wrap)}
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * Preview dirender di dalam `<PublicShell>` sungguhan, bukan markup tiruan.
 *
 * Dua alasan, keduanya soal apa yang sedang dinilai user:
 *
 *   1. `.hb2d1n` + modifier `--home`/`--category`/`--opentrip`/`--package` itu
 *      root dari seluruh `legacy.css`. Tanpa itu, komponen yang sama persis
 *      tetap tampil polos.
 *   2. Header, menu, footer, dan tombol WhatsApp adalah bagian dari desain
 *      halaman. Kalau tidak ikut dirender, user tidak pernah punya alasan untuk
 *      melihat apakah ada yang perlu diubah di sana.
 *
 * Tombol WhatsApp melayang memakai pesan global dari Pengaturan, sama seperti
 * route publik — nomor/sapaan/pesan per halaman hanya menggantikan tombol di
 * badan halaman (hero, kartu, banner CTA).
 */
function renderPreview(preview: PreviewSpec, values: FormValues, wrap: SectionWrap): ReactNode {
  /**
   * Halaman HTML mandiri tidak dibungkus `<PublicShell>` secara utuh:
   * dokumennya dirender di luar layout situs (iframe `data:`), sementara
   * kartunya justru perlu konteks beranda yang lengkap. Pratinjau
   * mengembalikan dua blok berlabel — masing-masing `wrap("doc", …)` dan
   * `wrap("card", …)` — supaya klik satu blok melompat ke group field-nya.
   */
  if (preview.kind === "doc") {
    const draft = htmlPagePreview(preview.base, values);
    return wrap("doc", <HalamanDocPreview html={draft.html} slug={draft.slug} basePath="/bio" />);
  }

  if (preview.kind === "htmlpage") {
    const draft = htmlPagePreview(preview.base, values);
    return (
      <>
        {wrap("doc", <HalamanDocPreview html={draft.html} slug={draft.slug} />)}
        {wrap(
          "card",
          <HalamanCardPreview
            shell={preview.shell}
            card={draft.card}
            visible={draft.cardVisible}
            reason={draft.isPublished ? "unplaced" : "unpublished"}
          />,
        )}
      </>
    );
  }

  /**
   * Halaman link-bio dirender di luar `<PublicShell>` — sama seperti route
   * publiknya (`/bio/<slug>`), yang memang tidak memakai kerangka situs.
   * `wrap` diteruskan supaya klik bagian di pratinjau membuka group field.
   */
  if (preview.kind === "bio") {
    return <BioLinkPage data={bioPreview(values)} section={wrap} />;
  }

  const { shell } = preview;
  let body: ReactNode;
  const waMessage = shell.waMessage;
  // Varian CSS kategori mengikuti pilihan "Tipe trip" di form, bukan nilai saat
  // halaman dibuka. Ini yang membuat "Kategori baru" berganti gaya Open Trip /
  // Private begitu select diubah, tanpa harus menyimpan lebih dulu.
  let variant = shell.variant;

  if (preview.kind === "category") {
    const kind = typeof values.kind === "string" && values.kind ? values.kind : preview.base.kind;
    variant = kind === "OPEN_TRIP" ? "opentrip" : "category";
    body = (
      <>
        {wrap(
          "card",
          /**
           * Kartu kategori di beranda.
           *
           * Field-nya ada di section "Kartu di Beranda" milik editor kategori,
           * tapi kartu ini tidak pernah muncul di halaman kategori — ia hanya
           * dirender di blok "pilihan tipe trip" di beranda. Tanpa pratinjau di
           * sini, satu-satunya cara menilai isinya adalah membuka editor
           * beranda, yang jauh dari tempat field itu disunting.
           *
           * Judul seksi-nya ikut dari beranda (`homeTypes*`) dan tidak bisa
           * disunting dari editor kategori, jadi yang ditampilkan hanya grid
           * kartunya.
           */
          <section className="section container">
            <TypeCardGrid items={[categoryTypeCard(preview.base, values)]} />
          </section>,
        )}
        <CategoryBody
          category={categoryPreview(preview.base, values)}
          waNumber={shell.waNumber}
          waMessage={shell.waMessage}
          waGreeting={shell.waGreeting}
          ctaBackground={preview.ctaBackgroundFallback}
          pages={preview.pages}
          wrap={wrap}
        />
      </>
    );
  } else if (preview.kind === "package") {
    const pkg = packagePreview(preview.base, values);
    body = (
      <>
        {wrap(
          "card",
          <section className="section container">
            <div className="package-grid cols-3">
              <PackageCard
                pkg={packageCardPreview(preview.base, values)}
                waNumber={shell.waNumber}
                context="listing"
              />
            </div>
          </section>,
        )}
        <PackageBody
          pkg={pkg}
          waNumber={shell.waNumber}
          waMessage={shell.waMessage}
          waGreeting={shell.waGreeting}
          ctaBackground={preview.ctaBackgroundFallback}
          wrap={wrap}
        />
      </>
    );
  } else {
    const home = homePreview(preview.base, values);
    body = (
      <HomeBody
        {...home}
        settings={homeSettingsPreview(preview.base, values)}
        pages={preview.pages}
        wrap={wrap}
      />
    );
  }

  return (
    <PublicShell
      variant={variant}
      waNumber={shell.waNumber}
      waMessage={waMessage}
      waGreeting={shell.waGreeting}
      nav={shell.nav}
      footer={shell.footer}
    >
      {body}
    </PublicShell>
  );
}

function PreviewSection({
  section,
  active,
  onSelect,
  label,
  children,
}: {
  section: string;
  active: boolean;
  onSelect: () => void;
  label?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`live-section${active ? " is-active" : ""}`}
      data-section={section}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="live-section__tag">{label ?? section}</span>
      {children}
    </div>
  );
}

/**
 * Accordion section.
 *
 * Bodinya **tidak** di-unmount saat ditutup — hanya disembunyikan. Ini bukan
 * soal tampilan: `<form>` yang diserialisasi browser hanya mengambil input yang
 * ada di DOM, jadi meng-unmount field yang sedang tertutup berarti nilainya
 * hilang dari `FormData` dan tersimpan sebagai kosong. Karena itu setiap section
 * tetap ter-render penuh dan `hidden` hanya influential pada sisi visual.
 */
function LiveAccordion({
  section,
  index,
  isOpen,
  isFocused,
  values,
  errors,
  numbers,
  onToggle,
  onChange,
}: {
  section: FieldSection;
  index: number;
  isOpen: boolean;
  isFocused: boolean;
  values: FormValues;
  errors: ErrorMap;
  numbers: Record<string, number>;
  onToggle: (id: string) => void;
  onChange: (name: string, value: unknown) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <section
      className={`live-accordion${isOpen ? " is-open" : ""}${isFocused ? " is-focused" : ""}`}
      data-section-panel={section.id}
    >
      <button
        type="button"
        className="live-accordion__head"
        aria-expanded={isOpen}
        aria-controls={`live-section-${section.id}`}
        onClick={() => onToggle(section.id)}
      >
        <span className="live-accordion__num">{index + 1}</span>
        <span className="live-accordion__title">
          {section.title}
          {section.help ? <small>{section.help}</small> : null}
        </span>
        <span className="live-accordion__caret" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      <div
        className="live-accordion__body"
        id={`live-section-${section.id}`}
        ref={bodyRef}
        hidden={!isOpen}
      >
        <FormFields
          fields={section.fields}
          values={values}
          errors={errors}
          numbers={numbers}
          onChange={onChange}
        />
      </div>
    </section>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button className="admin-btn admin-btn--primary" type="submit" disabled={pending}>
      {pending ? "Menyimpan…" : label}
    </button>
  );
}

export type { ErrorMap };