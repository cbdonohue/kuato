export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-latest";

export function hasLlmKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export function resolveLlmModel(provider: "openai" | "anthropic"): string {
  const override = process.env.AI_MODEL?.trim();
  if (override) return override;
  return provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
}

export type LlmOptions = {
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
  temperature?: number;
};

export async function completeLlm(opts: LlmOptions): Promise<string | null> {
  if (!hasLlmKey()) return null;
  return process.env.OPENAI_API_KEY
    ? callOpenAi(opts)
    : callAnthropic(opts);
}

async function callOpenAi(opts: LlmOptions): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: resolveLlmModel("openai"),
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 180,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(opts: LlmOptions): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: resolveLlmModel("anthropic"),
        max_tokens: opts.maxTokens ?? 180,
        temperature: opts.temperature ?? 0.4,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((part) => part.type === "text")?.text;
    return text?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
