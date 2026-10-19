import { LiveEditor } from "@/components/admin/live-editor";
import { bioPreviewBase } from "@/lib/admin/preview-base";
import { sosmedSections } from "@/lib/admin/sosmed-fields";
import { requireSessionUser } from "@/lib/auth";
import { emptyBio } from "@/lib/bio";

import { saveSosmedAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSosmedPage() {
  await requireSessionUser();

  const preview = await bioPreviewBase();

  return (
    <LiveEditor
      title="Halaman link-bio baru"
      backHref="/adm-cms-hb/sosmed"
      backLabel="Semua halaman sosmed"
      submitLabel="Buat halaman"
      sections={sosmedSections()}
      initial={{ ...emptyBio(), waGreeting: "Halo", isPublished: true, order: 0 }}
      action={saveSosmedAction}
      preview={{ kind: "bio", ...preview }}
    />
  );
}
