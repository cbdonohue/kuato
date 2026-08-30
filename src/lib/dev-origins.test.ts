import { describe, expect, it } from "vitest";
import { isCsrfOriginAllowed } from "next/dist/server/app-render/csrf-protection";
import {
  allowedDevOrigins,
  codespacePreviewHost,
  serverActionAllowedOrigins,
} from "./dev-origins";

describe("codespacePreviewHost", () => {
  it("builds the forwarded preview host from Codespaces env", () => {
    expect(
      codespacePreviewHost({
        CODESPACE_NAME: "musical-space-halibut-vppv6vqjqghxrjv",
        GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      }),
    ).toBe(
      "musical-space-halibut-vppv6vqjqghxrjv-3000.app.github.dev",
    );
  });

  it("is undefined outside Codespaces", () => {
    expect(codespacePreviewHost({})).toBeUndefined();
  });
});

describe("serverActionAllowedOrigins", () => {
  const origins = serverActionAllowedOrigins({
    CODESPACE_NAME: "musical-space-halibut-vppv6vqjqghxrjv",
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
  });

  it("allows a Simple Browser origin of localhost:3000", () => {
    expect(isCsrfOriginAllowed("localhost:3000", origins)).toBe(true);
  });

  it("allows the Codespaces forwarded host as an origin", () => {
    expect(
      isCsrfOriginAllowed(
        "musical-space-halibut-vppv6vqjqghxrjv-3000.app.github.dev",
        origins,
      ),
    ).toBe(true);
  });

  it("rejects an unrelated host", () => {
    expect(isCsrfOriginAllowed("evil.example", origins)).toBe(false);
  });
});

describe("allowedDevOrigins", () => {
  it("keeps the Cursor Cloud host and Codespaces wildcard", () => {
    expect(allowedDevOrigins({})).toEqual([
      "23.21.247.220",
      "*.app.github.dev",
    ]);
  });
});
