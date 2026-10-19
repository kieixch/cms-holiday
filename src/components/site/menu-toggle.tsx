"use client";

import { useEffect, useState } from "react";

/**
 * Tombol menu mobile.
 *
 * Di markup asli ini tombol `<button class="menu-toggle" id="hbMenuToggle">` plus
 * script kecil yang menambah class `open` pada `<nav id="hbNav">`. Di sini
 * logikanya pindah ke React supaya tidak ada inline script.
 */
export function MenuToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nav = document.getElementById("hbNav");
    if (!nav) return;
    nav.classList.toggle("open", open);
  }, [open]);

  return (
    <button
      type="button"
      className="menu-toggle"
      aria-label={open ? "Tutup menu" : "Buka menu"}
      aria-expanded={open}
      aria-controls="hbNav"
      onClick={() => setOpen((v) => !v)}
    >
      {open ? "✕" : "☰"}
    </button>
  );
}
