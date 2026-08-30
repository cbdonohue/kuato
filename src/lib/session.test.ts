import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { createSessionToken, SESSION_COOKIE, SESSION_MS } from "./auth";
import {
  createSession,
  deleteSession,
  hasSession,
  unauthorizedResponse,
} from "./session";

const originalPassword = process.env.SITE_PASSWORD;

describe("session helpers", () => {
  beforeEach(() => {
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookieStore.get.mockReset();
    process.env.SITE_PASSWORD = "draft-pass";
  });

  afterEach(() => {
    if (originalPassword === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = originalPassword;
  });

  it("writes an httpOnly session cookie", async () => {
    await createSession();
    expect(cookieStore.set).toHaveBeenCalledOnce();
    const [name, value, options] = cookieStore.set.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE);
    expect(typeof value).toBe("string");
    expect(value).toContain(".");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MS / 1000,
    });
  });

  it("clears the session cookie", async () => {
    await deleteSession();
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });

  it("validates the cookie token", async () => {
    cookieStore.get.mockReturnValue({ value: createSessionToken() });
    expect(await hasSession()).toBe(true);
    cookieStore.get.mockReturnValue(undefined);
    expect(await hasSession()).toBe(false);
  });

  it("returns 401 when there is no session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const denied = await unauthorizedResponse();
    expect(denied?.status).toBe(401);
    expect(await denied?.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns null when the session is valid", async () => {
    cookieStore.get.mockReturnValue({ value: createSessionToken() });
    expect(await unauthorizedResponse()).toBeNull();
  });
});
