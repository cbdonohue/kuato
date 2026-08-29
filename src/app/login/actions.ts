"use server";

import { credentialsMatch } from "@/lib/auth";
import { createSession, deleteSession } from "@/lib/session";
import { redirect } from "next/navigation";

export type LoginState = { error?: string } | undefined;

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!process.env.SITE_PASSWORD) {
    return { error: "SITE_PASSWORD is not set on the server." };
  }

  const password = String(formData.get("password") ?? "");
  if (!credentialsMatch(password)) {
    return { error: "Wrong password." };
  }

  await createSession();
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
