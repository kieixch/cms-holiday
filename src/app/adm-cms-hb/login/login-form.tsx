"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

/**
 * Formulir login admin.
 *
 * `useActionState` dipakai supaya pesan error dari server action tampil tanpa
 * reload halaman penuh.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="admin-card login-card">
      {state.error ? (
        <p className="admin-alert admin-alert--error" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="admin-field">
        <label htmlFor="email">Email</label>
        <input
          className="admin-input"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div className="admin-field">
        <label htmlFor="password">Password</label>
        <input
          className="admin-input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button className="admin-btn admin-btn--block" type="submit" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
