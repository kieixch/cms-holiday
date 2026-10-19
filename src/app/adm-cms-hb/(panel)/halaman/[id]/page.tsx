import { notFound } from "next/navigation";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { LiveEditor } from "@/components/admin/live-editor";
import { halamanSections } from "@/lib/admin/halaman-fields";
import { categoryOptions, halamanPreviewBase } from "@/lib/admin/preview-base";
import { omit } from "@/lib/admin/values";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { deleteHalamanAction, saveHalamanAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditHalamanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tersimpan?: string }>;
}) {
  await requireSessionUser();

  const { id } = await params;
  const { tersimpan } = await searchParams;

  const page = await prisma.htmlPage.findUnique({ where: { id } });
  if (!page) notFound();

  const initial = omit(page, ["id", "createdAt", "updatedAt"]);
  const [preview, categories] = await Promise.all([halamanPreviewBase(page), categoryOptions()]);

  return (
    <>
      {tersimpan ? (
        <p className="admin-notice" role="status">
          Halaman tersimpan.
        </p>
      ) : null}

      <LiveEditor
        title={`Ubah ${page.title}`}
        backHref="/adm-cms-hb/halaman"
        backLabel="Semua halaman"
        submitLabel="Simpan halaman"
        sections={halamanSections(categories)}
        initial={initial}
        action={saveHalamanAction}
        preview={{ kind: "htmlpage", ...preview }}
        hidden={{ id: page.id }}
      />

      <form action={deleteHalamanAction} className="admin-danger-zone">
        <input type="hidden" name="id" value={page.id} />
        <h2>Hapus halaman</h2>
        <p className="admin-hint">
          Kartu di beranda/kategori ikut hilang, dan /halaman/{page.slug} berhenti tampil.
          Tindakan ini tidak bisa dibatalkan.
        </p>
        <ConfirmSubmit confirm={`Hapus halaman "${page.title}"?`}>
          Hapus halaman
        </ConfirmSubmit>
      </form>
    </>
  );
}
