"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  widthClass,
  type Field,
  type MatrixField,
  type Option,
  type RepeaterField,
} from "@/lib/admin/fields";

import { ImagePicker } from "./image-picker";

export type FormValues = Record<string, unknown>;

/** Peta path → pesan, misalnya `itinerary.2.label`. */
export type ErrorMap = Record<string, string>;

type Props = {
  fields: Field[];
  values: FormValues;
  errors: ErrorMap;
  /** Nomor urut per nama field, untuk daftar bernomor di panel kiri. */
  numbers?: Record<string, number>;
  onChange: (name: string, value: unknown) => void;
};

/**
 * Renderer field generik.
 *
 * Sepenuhnya controlled: nilai form disimpan di state `values` milik `<AdminForm>`.
 * Ini disengaja. Kalau memakai `defaultValue` (uncontrolled), React me-remount
 * input setiap kali server action selesai, dan semua yang sudah diketik hilang
 * tepat saat validasi gagal — user harus mengetik ulang dari nol.
 */
export function FormFields({ fields, values, errors, numbers, onChange }: Props) {
  return (
    <div className="admin-form-grid">
      {fields.map((field) => (
        <FieldControl
          key={field.name}
          field={field}
          path={field.name}
          values={values}
          root={values}
          errors={errors}
          number={numbers?.[field.name]}
          onChange={(v) => onChange(field.name, v)}
        />
      ))}
    </div>
  );
}

type FieldProps = {
  field: Field;
  /** Path lengkap field ini, mis. `itinerary.2.label`. */
  path: string;
  /** Nilai level ini. Untuk repeater, ini isi satu baris. */
  values: FormValues;
  /**
   * Nilai level teratas form.
   *
   * Field matriks butuh daftar kolom yang berada di level teratas, sementara
   * ia sendiri dirender dua tingkat lebih dalam (baris → nilai). `root`
   * diteruskan supaya control tidak perlu menebak-nebak lewat `values`.
   */
  root: FormValues;
  errors: ErrorMap;
  /** Nomor urut tampilan; `undefined` untuk field anak repeater. */
  number?: number;
  onChange: (value: unknown) => void;
};

function FieldControl({ field, path, values, root, errors, number, onChange }: FieldProps) {
  const error = errors[path];
  const disabled = isFieldDisabled(field, values);

  if (field.kind === "repeater") {
    return (
      <RepeaterControl
        field={field}
        path={path}
        items={Array.isArray(values[field.name]) ? (values[field.name] as FormValues[]) : []}
        // Field matriks mencari daftar kolomnya di `root`. Kolom itu selevel
        // dengan repeater barisnya (mis. `priceColumns` selevel `prices`),
        // bukan selevel tiap baris. Jadi repeater mewariskan level pemiliknya
        // sebagai `root` ke anak-anaknya, bukan root teratas form.
        root={values}
        errors={errors}
        number={number}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "matrix") {
    const columns = Array.isArray(root[field.columnsField])
      ? (root[field.columnsField] as FormValues[])
      : [];
    return (
      <MatrixControl
        field={field}
        path={path}
        columns={columns}
        values={stringRecord(values[field.name])}
        errors={errors}
        onChange={onChange}
      />
    );
  }

  const label = (
    <span className="admin-field__label">
      {number !== undefined ? <span className="admin-field__num">{number}.</span> : null}
      {field.label}
      {field.required ? (
        <span className="admin-req" aria-hidden="true">
          {" "}
          *
        </span>
      ) : null}
    </span>
  );
  const help = field.help ? <small className="admin-field__help">{field.help}</small> : null;

  if (field.kind === "boolean") {
    return (
      <div className={widthClass(field)}>
        <label className="admin-check" htmlFor={path}>
          <input
            id={path}
            name={path}
            type="checkbox"
            checked={Boolean(values[field.name])}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            {field.label}
            {help}
          </span>
        </label>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <div className={`admin-field ${widthClass(field)}`}>
        <label htmlFor={path}>{label}</label>
        <select
          className="admin-select"
          id={path}
          name={path}
          value={String(values[field.name] ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— pilih —</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {help}
        {disabled ? <DisabledNote value={values[field.name]} name={path} /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  if (field.kind === "selectMultiple") {
    const selected = Array.isArray(values[field.name]) ? (values[field.name] as string[]) : [];
    return (
      <div className={`admin-field ${widthClass(field)}`}>
        <label htmlFor={path}>{label}</label>
        <MultiCheckDropdown
          id={path}
          name={path}
          options={field.options}
          selected={selected}
          onChange={onChange}
          placeholder="Pilih Kategori"
        />
        {help}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  if (field.kind === "number") {
    const raw = values[field.name];
    return (
      <div className={`admin-field ${widthClass(field)}`}>
        <label htmlFor={path}>{label}</label>
        <input
          className="admin-input"
          id={path}
          name={path}
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          value={raw === null || raw === undefined ? "" : String(raw)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        {help}
        {disabled ? <DisabledNote value={raw} name={path} /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  if (field.kind === "image") {
    const raw = values[field.name];
    return (
      <ImagePicker
        name={path}
        label={field.label}
        help={field.help}
        error={error}
        multiple={field.multiple}
        required={field.required === true && field.multiple !== true}
        value={typeof raw === "string" ? raw : null}
        values={Array.isArray(raw) ? (raw as string[]) : []}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "strings" || field.list) {
    const list = Array.isArray(values[field.name]) ? (values[field.name] as string[]) : [];
    return (
      <div className={`admin-field ${widthClass(field)}`}>
        <label htmlFor={path}>{label}</label>
        <AutoGrowTextarea
          id={path}
          name={path}
          rows={Math.min(12, Math.max(3, list.length + 1))}
          value={list.join("\n")}
          placeholder={field.placeholder ?? "Satu nilai per baris"}
          disabled={disabled}
          onChange={(v) =>
            onChange(
              v
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            )
          }
        />
        {help}
        {disabled ? <DisabledNote value={list} name={path} /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  if (field.kind === "textarea") {
    return (
      <div className={`admin-field ${widthClass(field)}`}>
        <label htmlFor={path}>{label}</label>
        <AutoGrowTextarea
          id={path}
          name={path}
          rows={field.rows ?? 3}
          value={String(values[field.name] ?? "")}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={onChange}
        />
        {help}
        {disabled ? <DisabledNote value={values[field.name]} name={path} /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  // Editor kode: textarea monospace tetap tinggi (bukan auto-grow) karena
  // dokumen HTML bisa ratusan baris — tingginya diatur admin lewat pegangan
  // resize, dan spasi/tabs di dalam dokumen tidak boleh dipotong.
  if (field.kind === "code") {
    return (
      <div className={`admin-field ${widthClass(field)}`}>
        <label htmlFor={path}>{label}</label>
        <textarea
          className="admin-textarea admin-code"
          id={path}
          name={path}
          rows={field.rows ?? 16}
          value={String(values[field.name] ?? "")}
          placeholder={field.placeholder}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        {help}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  // Field teks satu baris tetap dirender sebagai textarea yang tumbuh otomatis
  // supaya nilai panjang turun ke bawah, bukan melebar ke samping dan
  // "tenggelam". Enter dimatikan agar nilainya tetap satu baris logis.
  // Tipe khusus (email/url/date) tetap pakai `<input>` karena butuh validasi
  // dan keyboard bawaan perangkat.
  if (!field.type || field.type === "text") {
    return (
      <div className={`admin-field ${widthClass(field)}`}>
        <label htmlFor={path}>{label}</label>
        <AutoGrowTextarea
          id={path}
          name={path}
          className="admin-textarea admin-textarea--grow"
          singleLine
          value={String(values[field.name] ?? "")}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={onChange}
        />
        {help}
        {disabled ? <DisabledNote value={values[field.name]} name={path} /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>
    );
  }

  return (
    <div className={`admin-field ${widthClass(field)}`}>
      <label htmlFor={path}>{label}</label>
      <input
        className="admin-input"
        id={path}
        name={path}
        type={field.type ?? "text"}
        value={String(values[field.name] ?? "")}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {help}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

/**
 * Dropdown pilihan ganda berbasis centang.
 *
 * Menggantikan `<select multiple>` yang mengharuskan Ctrl/Cmd-klik. Tombolnya
 * hanya menampilkan ringkasan; nilainya dikirim lewat input tersembunyi satu
 * per opsi terpilih supaya `parseFields()` di server tetap menerima `string[]`
 * dengan nama field yang sama.
 */
function MultiCheckDropdown({
  id,
  name,
  options,
  selected,
  onChange,
  placeholder,
}: {
  id: string;
  name: string;
  options: Option[];
  selected: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );

  const chosen = options.filter((option) => selected.includes(option.value));
  const summary = chosen.length > 0 ? chosen.map((option) => option.label).join(", ") : placeholder;

  return (
    <div className="admin-multicheck" ref={rootRef}>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <button
        type="button"
        id={id}
        className="admin-multicheck__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={options.length === 0}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={chosen.length > 0 ? undefined : "admin-multicheck__placeholder"}>
          {options.length === 0 ? "Belum ada kategori" : summary}
        </span>
        <span className="admin-multicheck__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="admin-multicheck__menu" role="listbox" aria-multiselectable="true">
          {options.map((option) => (
            <label className="admin-multicheck__opt" key={option.value}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Textarea yang tingginya mengikuti isi.
 *
 * Nilai panjang tidak lagi melebar / scroll ke samping: tinggi dihitung ulang
 * dari `scrollHeight` setiap kali nilai berubah. `singleLine` mematikan Enter
 * supaya field yang secara logika satu baris (nama, slug, judul) tidak diam-diam
 * menyimpan baris baru — teksnya tetap membungkus ke bawah secara visual.
 */
function AutoGrowTextarea({
  id,
  name,
  value,
  placeholder,
  onChange,
  singleLine = false,
  disabled = false,
  className = "admin-textarea",
  rows = 1,
}: {
  id: string;
  name: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  singleLine?: boolean;
  disabled?: boolean;
  className?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={ref}
      className={className}
      id={id}
      name={name}
      rows={rows}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={
        singleLine
          ? (e) => {
              if (e.key === "Enter") e.preventDefault();
            }
          : undefined
      }
    />
  );
}

/**
 * Field non-aktif karena field lain diisi (`disabledWhen`).
 *
 * Nilainya tetap dikirim lewat input tersembunyi supaya menyimpan form saat
 * rotator aktif tidak menghapus nomor/pesan yang sudah diisi — begitu rotator
 * dikosongkan lagi, isian lama muncul kembali.
 */
function DisabledNote({ value, name }: { value: unknown; name: string }) {
  const hidden = Array.isArray(value)
    ? value.map((item) => String(item ?? "")).join("\n")
    : value === null || value === undefined
      ? ""
      : String(value);

  return (
    <>
      <input type="hidden" name={name} value={hidden} />
      <small className="admin-field__help admin-field__warn">
        Dinonaktifkan karena link rotator sudah diisi.
      </small>
    </>
  );
}

/** Field lain (`disabledWhen`) sudah berisi sehingga field ini tidak aktif. */
function isFieldDisabled(field: Field, values: FormValues): boolean {
  if (!field.disabledWhen) return false;
  const value = values[field.disabledWhen];
  if (typeof value === "string") return value.trim() !== "";
  if (value === null || value === undefined) return false;
  return String(value).trim() !== "";
}

type RepeaterProps = {
  field: RepeaterField;
  path: string;
  items: FormValues[];
  root: FormValues;
  errors: ErrorMap;
  /** Nomor urut dari daftar field panel kiri; `undefined` di form biasa. */
  number?: number;
  onChange: (value: FormValues[]) => void;
};

/**
 * Repeater untuk relasi anak (keunggulan, itinerary, fasilitas, galeri, harga).
 *
 * Jumlah item dikirim lewat input tersembunyi `<path>.__count`. Server tidak
 * bisa menebak jumlah baris dari `FormData` karena baris yang dikosongkan
 * semua nilainya tidak punya input sama sekali.
 *
 * Baris yang kosong total dibuang oleh `parseFields()` di server, jadi
 * "Tambah" lalu dibiarkan kosong tidak akan tersimpan.
 */
function RepeaterControl({ field, path, items, root, errors, number, onChange }: RepeaterProps) {
  const [adding, setAdding] = useState(false);
  const error = errors[path];

  const update = (index: number, childName: string, childValue: unknown) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [childName]: childValue } : item)));

  const removeAt = (index: number) => onChange(items.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved as FormValues);
    onChange(next);
  };

  return (
    <section className="admin-span-full admin-repeater">
      <header className="admin-repeater__head">
        <span className="admin-field__label">
          {number !== undefined ? <span className="admin-field__num">{number}.</span> : null}
          {field.label}
        </span>
        <div className="admin-repeater__tools">
          {adding ? (
            <>
              <button
                type="button"
                className="admin-btn admin-btn--small"
                onClick={() => {
                  onChange([...items, emptyItem(field.children, field)]);
                  setAdding(false);
                }}
              >
                Simpan baris kosong
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--small admin-btn--ghost"
                onClick={() => setAdding(false)}
              >
                Batal
              </button>
            </>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn--small"
              onClick={() => {
                onChange([...items, emptyItem(field.children, field)]);
                setAdding(false);
              }}
            >
              Tambah
            </button>
          )}
        </div>
      </header>

      <input type="hidden" name={`${path}.__count`} value={items.length} />

      {items.length === 0 ? (
        <p className="admin-empty admin-empty--tight">
          Belum ada {field.label.toLowerCase()}. Tekan Tambah untuk menambahkan.
        </p>
      ) : (
        <ol className="admin-repeater__list">
          {items.map((item, index) => (
            <li key={index} className="admin-repeater__item">
              <div className="admin-repeater__item-head">
                <span className="admin-repeater__index">{index + 1}</span>
                <span className="admin-repeater__summary">{summaryOf(item, field, index)}</span>
                <span className="admin-repeater__actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--small admin-btn--ghost"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Naikkan baris ${index + 1}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--small admin-btn--ghost"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Turunkan baris ${index + 1}`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--small admin-btn--danger"
                    onClick={() => removeAt(index)}
                    aria-label={`Hapus baris ${index + 1}`}
                  >
                    Hapus
                  </button>
                </span>
              </div>

              <div className="admin-form-grid">
                {field.children.map((child) => (
                  <FieldControl
                    key={child.name}
                    field={child}
                    path={`${path}.${index}.${child.name}`}
                    values={item}
                    root={root}
                    errors={errors}
                    onChange={(v) => update(index, child.name, v)}
                  />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {error ? <ErrorText>{error}</ErrorText> : null}
    </section>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="admin-error" role="alert">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Matriks harga                                                       */
/* ------------------------------------------------------------------ */

type MatrixProps = {
  field: MatrixField;
  path: string;
  columns: FormValues[];
  values: Record<string, string>;
  errors: ErrorMap;
  onChange: (value: Record<string, string>) => void;
};

/**
 * Satu input per kolom, untuk satu baris tabel harga.
 *
 * Nama input memakai `<path>.<columnId>`, jadi `parseMatrix()` di server bisa
 * kelompokkan nilainya tanpa perlu tahu jumlah kolom di muka. Kolom yang
 * kosong tidak dihapus dari baris — nilainya simply tidak ikut terkirim, jadi
 * `PriceValue` yang lama tidak ikut terhapus hanya karena satu sel dikosongkan.
 */
function MatrixControl({ field, path, columns, values, errors, onChange }: MatrixProps) {
  const error = errors[path];

  if (columns.length === 0) {
    return (
      <p className="admin-empty admin-empty--tight">
        {field.label}: tambahkan kolom dulu lewat daftar &quot;{field.columnsField}&quot;.
      </p>
    );
  }

  return (
    <div className="admin-span-full admin-matrix">
      <span className="admin-field__label">{field.label}</span>
      <div className="admin-matrix__row">
        {columns.map((column, index) => {
          const columnId = String(column[field.columnIdField] ?? "");
          if (!columnId) return null;
          const label = String(column[field.columnLabelField] ?? "");
          const cellPath = `${path}.${columnId}`;
          return (
            <label className="admin-matrix__cell" htmlFor={cellPath} key={columnId || index}>
              <span>{label || `Kolom ${index + 1}`}</span>
              <input
                className="admin-input"
                id={cellPath}
                name={cellPath}
                value={String(values[columnId] ?? "")}
                onChange={(e) => onChange({ ...values, [columnId]: e.target.value })}
              />
              {errors[cellPath] ? <ErrorText>{errors[cellPath]}</ErrorText> : null}
            </label>
          );
        })}
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Nilai sel matriks selalu teks; sel yang belum diisi berarti `""`. */
function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, cell] of Object.entries(value)) out[key] = String(cell ?? "");
  return out;
}

/**
 * Nilai kosong yang sesuai bentuk field anak, supaya input tidak `undefined`.
 */
export function emptyItem(children: Field[], parent?: RepeaterField): FormValues {
  const item: FormValues = {};
  for (const child of children) {
    if (child.kind === "boolean") item[child.name] = false;
    else if (child.kind === "number") item[child.name] = null;
    // Field gambar banyak juga menyimpan array URL, jadi ikut dikosongkan
    // sebagai `[]` — kalau dibiarkan `undefined`, `isEmptyItem()` di server
    // akan menghitung baris itu tidak kosong padahal picker belum diisi.
    else if (child.kind === "strings" || child.kind === "selectMultiple" || child.list)
      item[child.name] = [];
    // Field gambar banyak menyimpan array URL; yang tunggal tetap string.
    else if (child.kind === "image") item[child.name] = child.multiple ? [] : "";
    else if (child.kind === "repeater") item[child.name] = [];
    // Matriks harga kosong berarti belum ada sel yang diisi.
    else if (child.kind === "matrix") item[child.name] = {};
    else item[child.name] = "";
  }
  // Id kolom tabel harga harus tetap sama selama sesi edit supaya sel
  // matriksnya tidak kehilangan pasangannya. Pakai prefix `col_` supaya jelas
  // ini bukan cuid dari database dan tidak pernah ikut tersimpan.
  if (parent?.keyField) item[parent.keyField] = `col_${newKey()}`;
  return item;
}

let keyCounter = 0;

/** Id unik per sesi edit; cukup, karena tidak pernah masuk database. */
function newKey(): string {
  keyCounter += 1;
  return `${Date.now().toString(36)}${keyCounter.toString(36)}`;
}

/** Ringkasan singkat untuk judul baris, supaya list panjang tetap terbaca. */
function summaryOf(item: FormValues, field: RepeaterField, index: number): string {
  const named = field.itemTitleField
    ? field.children.find((c) => c.name === field.itemTitleField)
    : undefined;

  const first =
    named ??
    field.children.find(
      (c) => (c.kind === "text" || c.kind === "select") && typeof item[c.name] === "string",
    );
  if (!first) return `Baris ${index + 1}`;

  const value = String(item[first.name] ?? "");
  return value || "tanpa judul";
}
