import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session", () => ({
  unauthorizedResponse: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({
  hasLlmKey: vi.fn(),
}));
vi.mock("@/lib/ai-run", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-run")>();
  return {
    ...actual,
    runAiAction: vi.fn(),
  };
});

import { unauthorizedResponse } from "@/lib/session";
import { hasLlmKey } from "@/lib/llm";
import { AiRequestError, runAiAction } from "@/lib/ai-run";
import { SleeperNotFoundError } from "@/lib/sleeper";
import { POST } from "./route";

function post(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ draftId: "d1" }) };

describe("POST /api/drafts/[draftId]/ai", () => {
  beforeEach(() => {
    vi.mocked(unauthorizedResponse).mockResolvedValue(null);
    vi.mocked(hasLlmKey).mockReturnValue(true);
    vi.mocked(runAiAction).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(unauthorizedResponse).mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await POST(post("http://localhost/api/drafts/d1/ai?username=brian", { action: "review" }), params);
    expect(res.status).toBe(401);
    expect(runAiAction).not.toHaveBeenCalled();
  });

  it("returns 503 when AI is not configured", async () => {
    vi.mocked(hasLlmKey).mockReturnValue(false);
    const res = await POST(
      post("http://localhost/api/drafts/d1/ai?username=brian", { action: "review" }),
      params,
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "AI is not configured on this server." });
  });

  it("requires a username", async () => {
    const missing = await POST(post("http://localhost/api/drafts/d1/ai", { action: "review" }), params);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "username query is required" });

    const blank = await POST(
      post("http://localhost/api/drafts/d1/ai?username=%20", { action: "review" }),
      params,
    );
    expect(blank.status).toBe(400);
  });

  it("requires a JSON body and a valid action", async () => {
    const notJson = await POST(
      new NextRequest("http://localhost/api/drafts/d1/ai?username=brian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      params,
    );
    expect(notJson.status).toBe(400);
    expect(await notJson.json()).toEqual({ error: "JSON body is required" });

    const badAction = await POST(
      post("http://localhost/api/drafts/d1/ai?username=brian", { action: "dance" }),
      params,
    );
    expect(badAction.status).toBe(400);
    expect((await badAction.json()).error).toMatch(/action must be/);
  });

  it("returns the coach result for an authenticated user", async () => {
    vi.mocked(runAiAction).mockResolvedValue({ title: "Roster review", note: "Fill TE." });
    const res = await POST(
      post("http://localhost/api/drafts/d1/ai?username=brian", { action: "review" }),
      params,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: "Roster review", note: "Fill TE." });
    expect(runAiAction).toHaveBeenCalledWith("d1", "brian", { action: "review" });
  });

  it("maps AiRequestError, missing drafts, Error, and unknown throws", async () => {
    vi.mocked(runAiAction).mockRejectedValueOnce(new AiRequestError("That player is not on this board.", 404));
    const aiErr = await POST(
      post("http://localhost/api/drafts/d1/ai?username=brian", { action: "scout", playerId: "x" }),
      params,
    );
    expect(aiErr.status).toBe(404);
    expect(await aiErr.json()).toEqual({ error: "That player is not on this board." });

    vi.mocked(runAiAction).mockRejectedValueOnce(new AiRequestError("bad"));
    const defaultStatus = await POST(
      post("http://localhost/api/drafts/d1/ai?username=brian", { action: "review" }),
      params,
    );
    expect(defaultStatus.status).toBe(400);

    vi.mocked(runAiAction).mockRejectedValueOnce(new SleeperNotFoundError("draft d1"));
    const missing = await POST(
      post("http://localhost/api/drafts/d1/ai?username=brian", { action: "review" }),
      params,
    );
    expect(missing.status).toBe(404);

    vi.mocked(runAiAction).mockRejectedValueOnce(new Error("upstream"));
    const failed = await POST(
      post("http://localhost/api/drafts/d1/ai?username=brian", { action: "review" }),
      params,
    );
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "upstream" });

    vi.mocked(runAiAction).mockRejectedValueOnce("boom");
    const unknown = await POST(
      post("http://localhost/api/drafts/d1/ai?username=brian", { action: "review" }),
      params,
    );
    expect(unknown.status).toBe(502);
    expect(await unknown.json()).toEqual({ error: "Coach request failed" });
  });
});
