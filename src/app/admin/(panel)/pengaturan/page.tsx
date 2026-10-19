import { AdminForm } from "@/components/admin/admin-form";
import { settingsSections } from "@/lib/admin/settings-fields";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { saveSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Pengaturan global yang bukan isi halaman mana pun.
 *
 * Awalnya hanya tombol WhatsApp melayang (label + link rotator) yang muncul di
 * seluruh situs. Tanpa halaman ini, label "Chat Sekarang" hanya ada hard-coded
 * di komponen dan mustahil disunting dari panel.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tersimpan?: string }>;
}) {
  await requireSessionUser();

  const { tersimpan } = await searchParams;

  const settings = await prisma.siteSettings.findFirst();
  if (!settings) throw new Error("SiteSettings belum diisi. Jalankan `pnpm db:seed`.");

  const initial = {
    waNumber: settings.waNumber,
    waGreeting: settings.waGreeting,
    waMessage: settings.waMessage,
    stickyWaLabel: settings.stickyWaLabel,
    stickyWaLink: settings.stickyWaLink,
  };

  return (
    <>
      {tersimpan ? (
        <p className="admin-notice" role="status">
          Pengaturan tersimpan.
        </p>
      ) : null}

      <AdminForm
        title="Pengaturan"
        backHref="/admin"
        backLabel="Ringkasan"
        sections={settingsSections}
        initial={initial}
        action={saveSettingsAction}
        submitLabel="Simpan pengaturan"
      />

      <p className="admin-hint">
        Tombol melayang tampil di setiap halaman publik. <strong>Link rotator</strong> hanya
        menggantikan tujuan tombol melayang; tombol WhatsApp di hero, kartu paket, dan banner
        Ajakan Booking memakai link rotatornya sendiri di halaman masing-masing.
      </p>
    </>
  );
}
