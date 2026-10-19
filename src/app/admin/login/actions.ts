"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { endSession, getSessionUser, startSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { checkLoginRate, clearLoginRate, recordLoginFailure } from "@/lib/rate-limit";

export type LoginState = { error?: string };

/**
 * IP pengirim untuk pembatas laju login.
 *
 * `x-real-ip` di-set oleh reverse proxy tepercaya; kalau tidak ada, pakai
 * hop TERAKHIR `x-forwarded-for` — hop pertama justru dikontrol klien (bisa
 * dipalsukan per percobaan untuk mengelabui pembatas laju), sedangkan hop
 * terakhir ditambahkan proxy terdekat yang kita percaya.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}

/**
 * Hash bcrypt palsu (cost 12, dari string acak yang tidak disimpan) untuk
 * email yang tidak terdaftar. Tanpa ini, `bcrypt.compare` dilewati dan
 * respons yang lebih cepat membocorkan email mana yang punya akun.
 */
const DUMMY_PASSWORD_HASH = "$2b$12$nFVOps84OnRjelCHTvao.earGSrzc2N6iywGsmGtt8Ty/xSSlKRii";

const credentials = z.object({
  email: z.string().trim().min(1, "Email wajib diisi."),
  password: z.string().min(1, "Password wajib diisi."),
});

/**
 * Login admin.
 *
 * Kegagalan selalu mengembalikan pesan yang sama dan tetap membandingkan
 * password, supaya tidak bisa dipakai menebak email mana yang terdaftar.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = await clientIp();
  const ipKey = `ip:${ip}`;
  const userKey = `user:${ip}|${email}`;
  // Kunci tanpa IP: pembatasan tetap berlaku walaupun penyerang memutar-mutar
  // IP palsu lewat `x-forwarded-for`. Dipotong 160 karakter supaya input
  // acak tidak membuat kunci sepanjang apa pun.
  const emailKey = `email:${email.slice(0, 160)}`;
  const keys = [ipKey, userKey, emailKey];

  // Gerbang pembatas laju: dicek sebelum password diverifikasi supaya percobaan
  // beruntun tidak membebani bcrypt, dan supaya enumerasi email pun ikut dibatasi.
  for (const key of keys) {
    const gate = checkLoginRate(key);
    if (!gate.allowed) {
      const minutes = Math.max(1, Math.ceil(gate.retryAfterS / 60));
      return { error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${minutes} menit.` };
    }
  }

  const parsed = credentials.safeParse({
    email,
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    // Bentuk input cacat tetap dihitung sebagai percobaan gagal.
    for (const key of keys) recordLoginFailure(key);
    return { error: "Email atau password salah." };
  }

  const user = await prisma.adminUser.findUnique({ where: { email } });
  // Selalu jalankan bcrypt — termasuk untuk email yang tidak terdaftar —
  // supaya waktu respons tidak membocorkan email mana yang punya akun.
  const valid = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !valid) {
    // Pesan seragam: tidak membedakan email tidak dikenal dengan password salah.
    for (const key of keys) recordLoginFailure(key);
    return { error: "Email atau password salah." };
  }

  for (const key of keys) clearLoginRate(key);

  await startSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  redirect("/admin");
}

/** Keluar dari sesi. */
export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/admin/login");
}

/** Kalau sudah punya sesiValid, langsung lempar ke panel. */
export async function redirectIfSignedIn(): Promise<void> {
  if (await getSessionUser()) redirect("/admin");
}
