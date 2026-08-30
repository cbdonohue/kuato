import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { proxy } from "./proxy";

function request(path: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set("cookie", `session=${token}`);
  return new NextRequest(`http://localhost${path}`, { headers });
}

const originalPassword = process.env.SITE_PASSWORD;

afterEach(() => {
  if (originalPassword === undefined) delete process.env.SITE_PASSWORD;
  else process.env.SITE_PASSWORD = originalPassword;
});

describe("proxy", () => {
  it("lets anonymous users through to /login", () => {
    delete process.env.SITE_PASSWORD;
    const res = proxy(request("/login"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects signed-in users away from /login", () => {
    process.env.SITE_PASSWORD = "draft-pass";
    const res = proxy(request("/login", createSessionToken()));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("lets signed-in users continue", () => {
    process.env.SITE_PASSWORD = "draft-pass";
    const res = proxy(request("/draft/d1", createSessionToken()));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("returns 401 JSON for anonymous API calls", async () => {
    delete process.env.SITE_PASSWORD;
    const res = proxy(request("/api/users/brian/drafts"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("redirects anonymous page requests to /login", () => {
    delete process.env.SITE_PASSWORD;
    const res = proxy(request("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });
});

