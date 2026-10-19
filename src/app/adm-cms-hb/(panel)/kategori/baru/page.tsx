import { LiveEditor } from "@/components/admin/live-editor";
import { categorySections, emptyCategory } from "@/lib/admin/category-fields";
import { newCategoryPreviewBase } from "@/lib/admin/preview-base";
import { requireSessionUser } from "@/lib/auth";

import { saveCategoryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireSessionUser();

  const preview = await newCategoryPreviewBase();

  return (
    <LiveEditor
      title="Kategori baru"
      backHref="/adm-cms-hb/kategori"
      backLabel="Semua kategori"
      submitLabel="Buat kategori"
      sections={categorySections}
      initial={{
        ...emptyCategory(),
        waNumber: preview.base.waNumber,
        waGreeting: preview.base.waGreeting,
        waMessage: preview.base.waMessage,
        ctaWaNumber: preview.base.ctaWaNumber || preview.base.waNumber,
        ctaWaGreeting: preview.base.ctaWaGreeting || preview.base.waGreeting,
      }}
      action={saveCategoryAction}
      preview={{ kind: "category", ...preview }}
    />
  );
}