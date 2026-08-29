import { cookies } from "next/headers";
import {
  createSessionToken,
  isValidSessionToken,
  SESSION_COOKIE,
  SESSION_MS,
} from "@/lib/auth";

export async function createSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function hasSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function unauthorizedResponse(): Promise<Response | null> {
  if (await hasSession()) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
