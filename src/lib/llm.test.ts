import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeLlm,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_MODEL,
  hasLlmKey,
  resolveLlmModel,
} from "./llm";

const originalOpenAi = process.env.OPENAI_API_KEY;
const originalAnthropic = process.env.ANTHROPIC_API_KEY;
const originalModel = process.env.AI_MODEL;

afterEach(() => {
  if (originalOpenAi === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAi;
  if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalAnthropic;
  if (originalModel === undefined) delete process.env.AI_MODEL;
  else process.env.AI_MODEL = originalModel;
  vi.unstubAllGlobals();
});

describe("completeLlm", () => {
  it("returns null without a key", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(hasLlmKey()).toBe(false);
    expect(await completeLlm({ prompt: "hi" })).toBeNull();
  });

  it("uses OpenAI defaults and maps empty or thrown responses to null", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "  Take him.  " } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "   " } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await completeLlm({ prompt: "who?" })).toBe("Take him.");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
      temperature: number;
      max_tokens: number;
    };
    expect(body.model).toBe(DEFAULT_OPENAI_MODEL);
    expect(body.temperature).toBe(0.4);
    expect(body.max_tokens).toBe(180);

    expect(await completeLlm({ prompt: "empty" })).toBeNull();
    expect(await completeLlm({ prompt: "missing" })).toBeNull();
    expect(await completeLlm({ prompt: "throw" })).toBeNull();
  });

  it("uses Anthropic and maps missing text or thrown calls to null", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "ant-test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: "image" }, { type: "text", text: "  Fade.  " }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: "text", text: "  " }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await completeLlm({ prompt: "who?", maxTokens: 50, temperature: 0.2, timeoutMs: 1000 })).toBe(
      "Fade.",
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
    };
    expect(body.model).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(await completeLlm({ prompt: "blank" })).toBeNull();
    expect(await completeLlm({ prompt: "missing" })).toBeNull();
    expect(await completeLlm({ prompt: "throw" })).toBeNull();
  });

  it("sends AI_MODEL when set", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_MODEL = " gpt-4.1-mini ";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await completeLlm({ prompt: "who?" })).toBe("ok");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
    };
    expect(body.model).toBe("gpt-4.1-mini");
  });
});

describe("resolveLlmModel", () => {
  it("uses the provider default when AI_MODEL is empty", () => {
    delete process.env.AI_MODEL;
    expect(resolveLlmModel("openai")).toBe(DEFAULT_OPENAI_MODEL);
    expect(resolveLlmModel("anthropic")).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("trims AI_MODEL and ignores whitespace-only values", () => {
    process.env.AI_MODEL = "   ";
    expect(resolveLlmModel("openai")).toBe(DEFAULT_OPENAI_MODEL);
    process.env.AI_MODEL = "  claude-sonnet-4-0  ";
    expect(resolveLlmModel("anthropic")).toBe("claude-sonnet-4-0");
  });
});
