"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/components/admin/admin-form";
import type { Prisma } from "@/generated/prisma/client";
import { refreshAuditBaseline } from "@/lib/admin/audit-baseline";
import { trySyncContentFile } from "@/lib/admin/content-export";
import { parseFields } from "@/lib/admin/fields";
import { settingsFields } from "@/lib/admin/settings-fields";
import { buildValidator, errorMap } from "@/lib/admin/validate";
import { bumpContentVersion } from "@/lib/content-version";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const validator = buildValidator(settingsFields);

/**
 * Kolom `SiteSettings` yang boleh ditulis form Pengaturan.
 *
 * Sama seperti di editor beranda, daftarnya disalin eksplisit: `SiteSettings`
 * juga menyimpan identitas situs, kontak, footer, dan isi beranda, yang tidak
 * boleh bisa ditimpa lewat halaman ini.
 */
const SETTINGS_KEYS = ["waNumber", "waGreeting", "waMessage", "stickyWaLabel", "stickyWaLink"] as const;

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const result = validator.safeParse(parseFields(formData, settingsFields));
  if (!result.success) return { errors: errorMap(result.error) };

  const data = result.data as Record<string, unknown>;

  const settings = await prisma.siteSettings.findFirst();
  if (!settings) {
    return { message: "SiteSettings belum diisi. Jalankan `pnpm db:seed` terlebih dahulu." };
  }

  const columns: Record<string, unknown> = {};
  for (const key of SETTINGS_KEYS) columns[key] = data[key];

  try {
    await prisma.siteSettings.update({
      where: { id: settings.id },
      data: columns as Prisma.SiteSettingsUpdateInput,
    });
  } catch {
    return { message: "Gagal menyimpan: terjadi kesalahan di server." };
  }

  await trySyncContentFile();
  await refreshAuditBaseline();
  await bumpContentVersion();
  // Tombol melayang ada di kerangka setiap halaman, jadi seluruh route di
  // bawah root layout ikut disegarkan.
  revalidatePath("/", "layout");
  revalidatePath("/adm-cms-hb/pengaturan");

  redirect("/adm-cms-hb/pengaturan?tersimpan=1");
}
