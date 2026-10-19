import { notFound } from "next/navigation";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { LiveEditor } from "@/components/admin/live-editor";
import { bioPreviewBase } from "@/lib/admin/preview-base";
import { sosmedSections } from "@/lib/admin/sosmed-fields";
import { omit } from "@/lib/admin/values";
import { requireSessionUser } from "@/lib/auth";
import { normalizeBio } from "@/lib/bio";
import { prisma } from "@/lib/db";

import { deleteSosmedAction, saveSosmedAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditSosmedPage({
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
  if (!page || page.scope !== "sosmed") notFound();

  const initial = {
    ...omit(page, ["id", "createdAt", "updatedAt"]),
    ...normalizeBio(page.bio),
  };
  const preview = await bioPreviewBase(page);

  return (
    <>
      {tersimpan ? (
        <p className="admin-notice" role="status">
          Halaman tersimpan.
        </p>
      ) : null}

      <LiveEditor
        title={`Ubah ${page.title}`}
        backHref="/admin/sosmed"
        backLabel="Semua halaman sosmed"
        submitLabel="Simpan halaman"
        sections={sosmedSections()}
        initial={initial}
        action={saveSosmedAction}
        preview={{ kind: "bio", ...preview }}
        hidden={{ id: page.id }}
      />

      <form action={deleteSosmedAction} className="admin-danger-zone">
        <input type="hidden" name="id" value={page.id} />
        <h2>Hapus halaman</h2>
        <p className="admin-hint">
          /bio/{page.slug} berhenti tampil. Tindakan ini tidak bisa dibatalkan.
        </p>
        <ConfirmSubmit confirm={`Hapus halaman "${page.title}"?`}>
          Hapus halaman
        </ConfirmSubmit>
      </form>
    </>
  );
}
