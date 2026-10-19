import { notFound } from "next/navigation";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { LiveEditor } from "@/components/admin/live-editor";
import { categorySections, emptyCategory } from "@/lib/admin/category-fields";
import { categoryPreviewBase } from "@/lib/admin/preview-base";
import { omit } from "@/lib/admin/values";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { deleteCategoryAction, saveCategoryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tersimpan?: string }>;
}) {
  await requireSessionUser();

  const { slug } = await params;
  const { tersimpan } = await searchParams;

  const [category, preview, settings] = await Promise.all([
    prisma.category.findUnique({
      where: { slug },
      include: { benefits: { orderBy: { order: "asc" } } },
    }),
    categoryPreviewBase(slug),
    prisma.siteSettings.findFirst({ select: { waNumber: true, waGreeting: true, waMessage: true } }),
  ]);
  if (!category || !preview) notFound();

  const { benefits, ...scalars } = omit(category, ["id", "createdAt", "updatedAt"]);

  /**
   * Field WhatsApp tingkat kategori kosong berarti "pakai pengaturan global".
   * Supaya admin melihat pesan yang sedang berlaku (bukan kolom kosong), nilai
   * global dipakai sebagai isian awal saat kolom kategori belum diisi.
   */
  const waInitial = {
    waNumber: scalars.waNumber || settings?.waNumber || "",
    waGreeting: scalars.waGreeting || settings?.waGreeting || "",
    waMessage: scalars.waMessage || scalars.ctaMessage || settings?.waMessage || "",
    ctaWaNumber: scalars.ctaWaNumber || scalars.waNumber || settings?.waNumber || "",
    ctaWaGreeting: scalars.ctaWaGreeting || scalars.waGreeting || settings?.waGreeting || "",
  };

  return (
    <>
      {tersimpan ? (
        <p className="admin-notice" role="status">
          Kategori tersimpan.
        </p>
      ) : null}

      <LiveEditor
        title={`Ubah ${category.name}`}
        backHref="/admin/kategori"
        backLabel="Semua kategori"
        sections={categorySections}
        initial={{ ...emptyCategory(), ...scalars, ...waInitial, benefits }}
        action={saveCategoryAction}
        hidden={{ id: category.id }}
        preview={{ kind: "category", ...preview }}
      />

      <form action={deleteCategoryAction} className="admin-danger-zone">
        <input type="hidden" name="id" value={category.id} />
        <h2>Hapus kategori</h2>
        <p className="admin-hint">
          Paket di dalam kategori ini ikut terhapus. Tindakan ini tidak bisa dibatalkan.
        </p>
        <ConfirmSubmit confirm={`Hapus kategori "${category.name}" beserta paketnya?`}>
          Hapus kategori
        </ConfirmSubmit>
      </form>
    </>
  );
}