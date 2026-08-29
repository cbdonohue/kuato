import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  credentialsMatch,
  isValidSessionToken,
  passwordsMatch,
} from "./auth";

const originalPassword = process.env.SITE_PASSWORD;

afterEach(() => {
  if (originalPassword === undefined) {
    delete process.env.SITE_PASSWORD;
  } else {
    process.env.SITE_PASSWORD = originalPassword;
  }
});

describe("passwordsMatch", () => {
  it("accepts equal strings", () => {
    expect(passwordsMatch("secret", "secret")).toBe(true);
  });

  it("rejects different strings and lengths", () => {
    expect(passwordsMatch("secret", "Secret")).toBe(false);
    expect(passwordsMatch("ab", "abc")).toBe(false);
    expect(passwordsMatch("", "x")).toBe(false);
  });
});

describe("session tokens", () => {
  it("rejects when SITE_PASSWORD is unset", () => {
    delete process.env.SITE_PASSWORD;
    expect(credentialsMatch("anything")).toBe(false);
    expect(isValidSessionToken(createSessionToken())).toBe(false);
  });

  it("round-trips a valid token and expires it", () => {
    process.env.SITE_PASSWORD = "draft-pass";
    expect(credentialsMatch("draft-pass")).toBe(true);
    expect(credentialsMatch("nope")).toBe(false);

    const now = 1_700_000_000_000;
    const token = createSessionToken(now);
    expect(isValidSessionToken(token, now + 1000)).toBe(true);
    expect(isValidSessionToken(token, now + 8 * 24 * 60 * 60 * 1000)).toBe(
      false,
    );
    expect(isValidSessionToken("not-a-token", now)).toBe(false);
  });

  it("invalidates sessions after the password changes", () => {
    process.env.SITE_PASSWORD = "first";
    const token = createSessionToken();
    process.env.SITE_PASSWORD = "second";
    expect(isValidSessionToken(token)).toBe(false);
  });
});
