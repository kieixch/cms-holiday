"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Persentase perkiraan selama server action berjalan.
 *
 * Server action tidak mengirim progres bertahap: client hanya tahu "pending"
 * lalu "selesai". Karena itu persentase dihitung dari waktu berjalan dan
 * sengaja berhenti di 92% selama server belum menjawab, baru naik ke 100%
 * setelah `pending` berubah false. Angka tidak akan menyentuh 100% sebelum
 * penyimpanan benar-benar selesai.
 *
 * Kurva `1 - e^(-t/1600)` cepat di awal lalu melambat, jadi terasa seperti
 * progres sungguhan tanpa pernah "mentok" di satu angka.
 */
const TICK_MS = 160;
const EASE_MS = 1600;
const CEILING = 92;
const DONE_HOLD_MS = 450;

export function useSaveProgress(pending: boolean): number | null {
  const [percent, setPercent] = useState<number | null>(null);
  const phase = useRef<"idle" | "saving" | "done">("idle");

  useEffect(() => {
    let primer: ReturnType<typeof setTimeout> | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    let finish: ReturnType<typeof setTimeout> | undefined;
    let hide: ReturnType<typeof setTimeout> | undefined;

    if (pending) {
      phase.current = "saving";
      const startedAt = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startedAt;
        const value = Math.round(CEILING * (1 - Math.exp(-elapsed / EASE_MS)));
        setPercent(Math.max(1, Math.min(CEILING, value)));
      };
      // Timer, bukan setState langsung di body effect: aturan hooks React
      // melarang setState sinkron di dalam effect.
      primer = setTimeout(tick, 0);
      interval = setInterval(tick, TICK_MS);
    } else if (phase.current === "saving") {
      phase.current = "done";
      finish = setTimeout(() => {
        setPercent(100);
        hide = setTimeout(() => {
          setPercent(null);
          phase.current = "idle";
        }, DONE_HOLD_MS);
      }, 0);
    }

    return () => {
      clearTimeout(primer);
      clearInterval(interval);
      clearTimeout(finish);
      clearTimeout(hide);
    };
  }, [pending]);

  return percent;
}

type SaveButtonProps = {
  pending: boolean;
  percent: number | null;
  label: string;
  className?: string;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
};

/**
 * Tombol simpan dengan persentase.
 *
 * Angka persen dibungkus `aria-hidden` supaya nama aksesibel tombol tetap
 * "Menyimpan…" dan pembaca layar tidak membacakan angka yang berubah tiap
 * 160ms. Persentase tetap terbaca lewat progress bar di `SaveProgress`.
 */
export function SaveButton({
  pending,
  percent,
  label,
  className = "admin-btn admin-btn--primary",
  type = "submit",
  disabled,
  onClick,
}: SaveButtonProps) {
  return (
    <button
      className={className}
      type={type}
      disabled={pending || disabled}
      onClick={onClick}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          Menyimpan
          <span aria-hidden="true">{percent === null ? "" : ` ${percent}%`}</span>
          …
        </>
      ) : (
        label
      )}
    </button>
  );
}

/**
 * Kartu progres kecil yang menempel di bawah layar.
 *
 * `position: fixed` supaya kemunculannya tidak menggeser isi form, dan
 * `pointer-events: none` supaya tidak menghalangi tombol di belakangnya.
 * Selesai ditahan sebentar di 100% agar user sempat melihat konfirmasi.
 */
export function SaveProgress({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const done = percent >= 100;

  return (
    <div className={`admin-save${done ? " is-done" : ""}`} role="status" aria-live="polite">
      <div className="admin-save__head">
        <span>{done ? "Selesai" : "Menyimpan perubahan"}</span>
        <strong aria-hidden="true">{percent}%</strong>
      </div>
      <div
        className="admin-save__track"
        role="progressbar"
        aria-label="Progres menyimpan perubahan"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className="admin-save__bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * Tombol simpan untuk form dengan native `<form action>` (tanpa
 * `useActionState`), mis. form metadata aset. `useFormStatus` harus dipanggil
 * dari komponen yang dirender di dalam `<form>`.
 */
export function ProgressSubmit({
  label = "Simpan",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const percent = useSaveProgress(pending);

  return (
    <>
      <SaveButton pending={pending} percent={percent} label={label} className={className} />
      <SaveProgress percent={percent} />
    </>
  );
}
