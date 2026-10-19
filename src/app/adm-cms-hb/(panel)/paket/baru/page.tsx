import { redirect } from "next/navigation";

import { LiveEditor } from "@/components/admin/live-editor";
import { buildPackageSections, emptyPackage } from "@/lib/admin/package-fields";
import { globalCtaBackground, previewShell } from "@/lib/admin/preview-base";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { savePackageAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Halaman editor untuk paket yang belum pernah disimpan.
 *
 * Kategori masuk lewat `?kategori=`, jadi halaman ini selalu punya jawaban
 * untuk pertanyaan yang tidak ada di form: paket ini Open Trip atau Private,
 * dan boleh punya halaman detail atau tidak. `savePackageAction()` menyusun
 * `kind` dari kategori itu, jadi menang di sini berarti tidak ada lagi yang
 * perlu ditebak user.
 *
 * `/adm-cms-hb/paket/baru` tanpa `?kategori=` diarahkan balik ke daftar paket.
 * Halaman tanpa kategori bukan editor yang bisa dipakai — field "Kategori" di
 * panel kiri akan jadi satu-satunya tempat menjawab, dan justru itu yang ingin
 * dihindari.
 */
export default async function NewPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>;
}) {
  await requireSessionUser();

  const { kategori } = await searchParams;
  const slug = (kategori ?? "").trim();

  const [categories, shell, ctaBackgroundFallback] = await Promise.all([
    prisma.category.findMany({
      select: { slug: true, navLabel: true, name: true, kind: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    previewShell("package"),
    globalCtaBackground(),
  ]);

  const category = categories.find((item) => item.slug === slug);
  if (!category) redirect("/adm-cms-hb/paket");

  const options = categories.map((item) => ({
    value: item.slug,
    label: item.navLabel || item.name || item.slug,
  }));

  /**
   * Satu objek untuk form dan preview.
   *
   * `emptyPackage()` sengaja berisi kunci yang dibutuhkan `<PackageBody>` dan
   * kunci yang dibutuhkan form, jadi preview paket kosong langsung memakai
   * komponen publik yang sama seperti paket yang sudah tersimpan — bukan
   * kerangka kosong yang harus ditebak ulang.
   */
  const draft = emptyPackage(category.slug, category.kind);
  // Paket baru belum punya isian WhatsApp sendiri; tampilkan nilai global
  // supaya pesan yang sedang berlaku langsung terisi dan bisa disunting.
  draft.waNumber = shell.waNumber;
  draft.waGreeting = shell.waGreeting ?? "";
  draft.waMessage = shell.waMessage;
  draft.ctaWaNumber = shell.waNumber;
  draft.ctaWaGreeting = shell.waGreeting ?? "";

  return (
    <>
      <p className="admin-notice admin-notice--muted">
        Paket baru di kategori <strong>{options.find((o) => o.value === category.slug)?.label}</strong>
        . Form tersimpan kalau tombol Simpan ditekan — menutup halaman ini berarti
        paketnya tidak jadi dibuat.
      </p>

      <LiveEditor
        title="Paket baru"
        backHref="/adm-cms-hb/paket"
        backLabel="Semua paket"
        sections={buildPackageSections(options)}
        initial={draft}
        action={savePackageAction}
        submitLabel="Buat paket"
        preview={{ kind: "package", base: draft, shell, ctaBackgroundFallback }}
      />
    </>
  );
}