import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session", () => ({
  unauthorizedResponse: vi.fn(),
}));
vi.mock("@/lib/live", () => ({
  buildLiveState: vi.fn(),
}));

import { unauthorizedResponse } from "@/lib/session";
import { buildLiveState } from "@/lib/live";
import { SleeperNotFoundError } from "@/lib/sleeper";
import { GET } from "./route";

describe("GET /api/drafts/[draftId]/live", () => {
  beforeEach(() => {
    vi.mocked(unauthorizedResponse).mockResolvedValue(null);
    vi.mocked(buildLiveState).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(unauthorizedResponse).mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(new NextRequest("http://localhost/api/drafts/d1/live?username=brian"), {
      params: Promise.resolve({ draftId: "d1" }),
    });
    expect(res.status).toBe(401);
    expect(buildLiveState).not.toHaveBeenCalled();
  });

  it("requires a username", async () => {
    const res = await GET(new NextRequest("http://localhost/api/drafts/d1/live"), {
      params: Promise.resolve({ draftId: "d1" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "username query is required" });
  });

  it("returns live state for an authenticated user", async () => {
    vi.mocked(buildLiveState).mockResolvedValue({ draft: { draftId: "d1" } } as never);
    const res = await GET(
      new NextRequest("http://localhost/api/drafts/d1/live?username=brian"),
      { params: Promise.resolve({ draftId: "d1" }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ draft: { draftId: "d1" } });
    expect(buildLiveState).toHaveBeenCalledWith("d1", "brian");
  });

  it("maps missing drafts to 404 and other errors to 502", async () => {
    vi.mocked(buildLiveState).mockRejectedValueOnce(new SleeperNotFoundError("draft d1"));
    const missing = await GET(
      new NextRequest("http://localhost/api/drafts/d1/live?username=brian"),
      { params: Promise.resolve({ draftId: "d1" }) },
    );
    expect(missing.status).toBe(404);

    vi.mocked(buildLiveState).mockRejectedValueOnce(new Error("upstream"));
    const failed = await GET(
      new NextRequest("http://localhost/api/drafts/d1/live?username=brian"),
      { params: Promise.resolve({ draftId: "d1" }) },
    );
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "upstream" });

    vi.mocked(buildLiveState).mockRejectedValueOnce("boom");
    const unknown = await GET(
      new NextRequest("http://localhost/api/drafts/d1/live?username=brian"),
      { params: Promise.resolve({ draftId: "d1" }) },
    );
    expect(unknown.status).toBe(502);
    expect(await unknown.json()).toEqual({ error: "Failed to load draft" });
  });
});
