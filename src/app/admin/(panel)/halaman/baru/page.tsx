import { LiveEditor } from "@/components/admin/live-editor";
import { halamanSections } from "@/lib/admin/halaman-fields";
import { categoryOptions, halamanPreviewBase } from "@/lib/admin/preview-base";
import { requireSessionUser } from "@/lib/auth";

import { saveHalamanAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewHalamanPage() {
  await requireSessionUser();

  const [preview, categories] = await Promise.all([halamanPreviewBase(), categoryOptions()]);

  return (
    <LiveEditor
      title="Halaman baru"
      backHref="/admin/halaman"
      backLabel="Semua halaman"
      submitLabel="Buat halaman"
      sections={halamanSections(categories)}
      initial={{ isPublished: true, order: 0, categorySlugs: [] }}
      action={saveHalamanAction}
      preview={{ kind: "htmlpage", ...preview }}
    />
  );
}