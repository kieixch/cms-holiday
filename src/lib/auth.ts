import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "./db";
import { SESSION_COOKIE } from "./session-constants";

export { SESSION_COOKIE };

/** Masa berlaku sesi: 7 hari. */
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("ganti-")) {
    throw new Error(
      "AUTH_SECRET belum diset, terlalu pendek, atau masih placeholder. Buat dengan `openssl rand -base64 32` lalu tulis hasilnya ke AUTH_SECRET di .env.",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Token bertanda tangan yang ditaruh di cookie. */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(secretKey());
}

/** Pembungkus yang menulis cookie sesi. Hanya boleh dipanggil dari Server Function/Route Handler. */
export async function startSession(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

/** Hapus cookie sesi. */
export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * User yang sedang login, atau `null`.
 *
 * Token diverifikasi secara kriptografis *dan* checked ulang ke database,
 * jadi akun yang dihapus atau password yang dirotasi langsung kehilangan akses.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let sub: string;
  let issuedAt = 0;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    sub = payload.sub;
    if (typeof payload.iat === "number") issuedAt = payload.iat;
  } catch {
    return null;
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: sub },
    select: { id: true, email: true, name: true, role: true, passwordChangedAt: true },
  });
  if (!user) return null;

  // Token yang diterbitkan sebelum password terakhir diubah langsung tidak
  // berlaku: merotasi password memutus semua sesi lama.
  if (issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * Sama seperti `getSessionUser`, tapi mengarahkan ke halaman login bila belum
 * masuk. Dipakai di layout panel admin.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

/**
 * Seperti `requireSessionUser`, tapi juga memastikan role-nya `admin`.
 *
 * Dipakai layout panel. Bila kelak ada role dengan hak terbatas, ini mencegahnya
 * mewarisi seluruh akses menulis. Ditolak ke beranda publik (bukan login) supaya
 * tidak memicu lingkaran redirect dengan `redirectIfSignedIn`.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "admin") redirect("/");
  return user;
}
