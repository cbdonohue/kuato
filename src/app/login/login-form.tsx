"use client";

import { login, type LoginState } from "@/app/login/actions";
import { useActionState } from "react";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        autoFocus
        required
        className="h-12 rounded-lg border border-panel-border bg-panel px-4 text-base outline-none ring-accent/40 placeholder:text-muted focus:ring-2"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-lg bg-accent px-5 font-semibold text-black disabled:opacity-40"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state?.error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
