import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/session", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));

import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/session";
import { login, logout } from "./actions";

const originalPassword = process.env.SITE_PASSWORD;

afterEach(() => {
  if (originalPassword === undefined) delete process.env.SITE_PASSWORD;
  else process.env.SITE_PASSWORD = originalPassword;
  vi.mocked(createSession).mockReset();
  vi.mocked(deleteSession).mockReset();
  vi.mocked(redirect).mockClear();
});

describe("login", () => {
  it("errors when SITE_PASSWORD is unset", async () => {
    delete process.env.SITE_PASSWORD;
    await expect(login(undefined, new FormData())).resolves.toEqual({
      error: "SITE_PASSWORD is not set on the server.",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects the wrong password", async () => {
    process.env.SITE_PASSWORD = "draft-pass";
    const form = new FormData();
    form.set("password", "nope");
    await expect(login(undefined, form)).resolves.toEqual({
      error: "Wrong password.",
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("creates a session and redirects home", async () => {
    process.env.SITE_PASSWORD = "draft-pass";
    const form = new FormData();
    form.set("password", "draft-pass");
    await expect(login(undefined, form)).rejects.toThrow("REDIRECT:/");
    expect(createSession).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/");
  });
});

describe("logout", () => {
  it("clears the session and redirects to login", async () => {
    await expect(logout()).rejects.toThrow("REDIRECT:/login");
    expect(deleteSession).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
