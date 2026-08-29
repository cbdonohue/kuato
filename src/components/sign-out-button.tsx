"use client";

import { logout } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm text-muted transition hover:text-foreground"
      >
        Sign out
      </button>
    </form>
  );
}
