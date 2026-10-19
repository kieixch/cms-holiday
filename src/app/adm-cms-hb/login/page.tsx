import Link from "next/link";

import { LogoSvg } from "@/components/site/logo";
import { redirectIfSignedIn } from "./actions";
import { LoginForm } from "./login-form";

/**
 * Halaman login admin.
 *
 * Entry point-nya disembunyikan dari navigasi publik — logo di header membuka
 * halaman ini lewat klik tiga kali (lihat `TripleClickLink`).
 */
export default async function LoginPage() {
  await redirectIfSignedIn();

  return (
    <main className="login-page">
      <div className="login-brand" aria-label="Holiday Banyuwangi">
        <LogoSvg tone="dark" />
      </div>

      <p className="login-title">Panel Admin</p>
      <p className="login-sub">Masuk untuk mengelola isi situs.</p>

      <LoginForm />

      <p className="login-back">
        <Link href="/">← Kembali ke situs</Link>
      </p>
    </main>
  );
}
