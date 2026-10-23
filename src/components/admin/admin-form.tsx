"use client";

import Link from "next/link";
import { useActionState, useCallback, useMemo, useState } from "react";

import type { FieldSection } from "@/lib/admin/sections";

import { FormFields, type ErrorMap, type FormValues } from "./form-fields";
import { SaveButton, SaveProgress, useSaveProgress } from "./save-progress";

type Props = {
  /** Bagian bernomor yang dirender sebagai accordion. */
  sections: FieldSection[];
  /** Nilai awal: record dari DB saat edit, atau `{}` saat membuat baru. */
  initial?: FormValues;
  action: Action;
  submitLabel?: string;
  title: string;
  backHref?: string;
  backLabel?: string;
  /**
   * Input tersembunyi, mis. `{ id: record.id }` untuk membedakan ubah dari
   * buat baru. Sengaja props terpisah supaya `AdminForm` tidak perlu
   * `children` — form ini selalu owns seluruh isi `<form>`-nya.
   */
  hidden?: Record<string, string>;
};

/**
 * Hasil server action.
 *
 * Nilai field disimpan di state (lihat catatan di `form-fields.tsx`) supaya
 * isian user tetap utuh saat server action mengembalikan error validasi.
 */
export type FormState = {
  errors?: ErrorMap;
  message?: string;
};

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Form admin generik dengan bagian bernomor yang bisa dibuka-tutup.
 *
 * Field tetap ter-render penuh walau bagian sedang tertutup (`hidden` hanya
 * menyembunyikan secara visual, bukan melepas dari DOM) supaya nilainya tetap
 * ikut terkirim saat form disubmit.
 */
export function AdminForm({
  sections,
  initial,
  action,
  submitLabel = "Simpan",
  title,
  backHref,
  backLabel = "Kembali",
  hidden,
}: Props) {
  const [values, setValues] = useState<FormValues>(() => ({ ...initial }));
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const savePercent = useSaveProgress(pending);
  const [open, setOpen] = useState<string[]>(() => (sections[0] ? [sections[0].id] : []));

  const errors = state?.errors ?? {};

  const numbers = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    for (const section of sections) {
      for (const field of section.fields) {
        n += 1;
        map[field.name] = n;
      }
    }
    return map;
  }, [sections]);

  const toggle = useCallback(
    (id: string) =>
      setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  );

  const setValue = useCallback(
    (name: string, value: unknown) =>
      setValues((prev) => (Object.is(prev[name], value) ? prev : { ...prev, [name]: value })),
    [],
  );

  const errorList = Object.entries(errors);

  return (
    <form action={formAction} className="admin-form" noValidate>
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}

      <SaveProgress percent={savePercent} />

      <header className="admin-page-head">
        <div>
          {backHref ? (
            <Link className="admin-backlink" href={backHref}>
              ← {backLabel}
            </Link>
          ) : null}
          <h1>{title}</h1>
        </div>
        <SaveButton pending={pending} percent={savePercent} label={submitLabel} />
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
            {errorList.slice(0, 8).map(([path, msg]) => (
              <li key={path}>
                <code>{path}</code> — {msg}
              </li>
            ))}
            {errorList.length > 8 ? <li>…dan {errorList.length - 8} lainnya.</li> : null}
          </ul>
        </div>
      ) : null}

      <div className="live-editor__sections">
        {sections.map((section, index) => {
          const isOpen = open.includes(section.id);
          return (
            <section key={section.id} className="live-accordion">
              <button
                type="button"
                className="live-accordion__head"
                aria-expanded={isOpen}
                aria-controls={`admin-section-${section.id}`}
                onClick={() => toggle(section.id)}
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

              <div className="live-accordion__body" id={`admin-section-${section.id}`} hidden={!isOpen}>
                <FormFields
                  fields={section.fields}
                  values={values}
                  errors={errors}
                  numbers={numbers}
                  onChange={setValue}
                />
              </div>
            </section>
          );
        })}
      </div>

      <footer className="admin-form__footer">
        <SaveButton pending={pending} percent={savePercent} label={submitLabel} />
        {backHref ? (
          <Link className="admin-btn admin-btn--ghost" href={backHref}>
            Batal
          </Link>
        ) : null}
      </footer>
    </form>
  );
}
