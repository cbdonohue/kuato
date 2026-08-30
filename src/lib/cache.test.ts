import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, writeFile } from "fs/promises";
import { fetchText, loadDayCache, loadTtlCache } from "./cache";

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  ...fsMocks,
  default: fsMocks,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(mkdir).mockReset();
  vi.mocked(readFile).mockReset();
  vi.mocked(writeFile).mockReset();
});

describe("loadTtlCache", () => {
  it("returns memory on the second call without hitting disk or the loader", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("missing"));
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const loader = vi.fn().mockResolvedValue("fresh");

    expect(await loadTtlCache("mem-hit.json", 60_000, loader)).toBe("fresh");
    expect(await loadTtlCache("mem-hit.json", 60_000, loader)).toBe("fresh");
    expect(loader).toHaveBeenCalledOnce();
  });

  it("serves a still-fresh disk cache", async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ fetchedAt: Date.now(), data: "from-disk" }),
    );
    const loader = vi.fn();
    expect(await loadTtlCache("disk-hit.json", 60_000, loader)).toBe("from-disk");
    expect(loader).not.toHaveBeenCalled();
  });

  it("refetches when disk is stale and writes the new payload", async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ fetchedAt: Date.now() - 10_000, data: "old" }),
    );
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const loader = vi.fn().mockResolvedValue("new");

    expect(await loadTtlCache("stale-disk.json", 1000, loader)).toBe("new");
    expect(loader).toHaveBeenCalledOnce();
    expect(vi.mocked(writeFile)).toHaveBeenCalled();
  });

  it("falls back to stale disk data when the loader fails", async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ fetchedAt: 1, data: "stale-ok" }),
    );
    const loader = vi.fn().mockRejectedValue(new Error("network"));
    expect(await loadTtlCache("stale-fallback.json", 1, loader)).toBe("stale-ok");
  });

  it("rethrows when there is no cache and the loader fails", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("missing"));
    const loader = vi.fn().mockRejectedValue(new Error("network"));
    await expect(loadTtlCache("no-cache.json", 1000, loader)).rejects.toThrow("network");
  });
});

describe("loadDayCache", () => {
  it("loads through the day TTL helper", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("missing"));
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const loader = vi.fn().mockResolvedValue([1, 2]);
    expect(await loadDayCache("day.json", loader)).toEqual([1, 2]);
  });
});

describe("fetchText", () => {
  it("returns the body and sets a user agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "payload",
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchText("https://example.com/data")).toBe("payload");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      cache: "no-store",
      headers: { "User-Agent": "sleeper-draft-assistant" },
    });
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "nope",
      }),
    );
    await expect(fetchText("https://example.com/fail")).rejects.toThrow(
      "Fetch https://example.com/fail failed (503)",
    );
  });
});
