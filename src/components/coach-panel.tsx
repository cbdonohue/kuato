"use client";

import { suggestedQuestions } from "@/lib/ai";
import type { LiveState } from "@/lib/types";
import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type AiTrigger = {
  nonce: number;
  action:
    | "ask"
    | "scout"
    | "compare"
    | "review"
    | "briefing"
    | "board"
    | "injury";
  question?: string;
  playerId?: string;
  playerIds?: string[];
};

type CoachResult = {
  title: string;
  note: string;
};

export function CoachPanel({
  draftId,
  username,
  state,
  trigger,
  compareMode,
  selectedIds,
  selectedNames,
  onToggleCompare,
  onClearCompare,
  onCompareSelected,
}: {
  draftId: string;
  username: string;
  state: LiveState;
  trigger: AiTrigger | null;
  compareMode: boolean;
  selectedIds: string[];
  selectedNames: string[];
  onToggleCompare: () => void;
  onClearCompare: () => void;
  onCompareSelected: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastNonce = useRef(0);
  const suggestions = useMemo(() => suggestedQuestions(state), [state]);

  const run = useCallback(
    async (next: AiTrigger) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/drafts/${encodeURIComponent(draftId)}/ai?username=${encodeURIComponent(username)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: next.action,
              question: next.question,
              playerId: next.playerId,
              playerIds: next.playerIds,
            }),
            signal: controller.signal,
          },
        );
        const data = (await res.json()) as CoachResult & { error?: string };
        if (!res.ok) {
          setResult(null);
          setError(data.error || "Coach request failed");
          return;
        }
        setResult({ title: data.title, note: data.note });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult(null);
        setError("Network error talking to the coach");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    },
    [draftId, username],
  );

  useEffect(() => {
    if (!trigger || trigger.nonce === lastNonce.current) return;
    lastNonce.current = trigger.nonce;
    void run(trigger);
  }, [trigger, run]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function onAsk(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    void run({ nonce: Date.now(), action: "ask", question: text });
  }

  if (!state.aiEnabled) {
    return (
      <div className="rounded-xl border border-panel-border bg-panel px-4 py-3 text-sm text-muted">
        Add <span className="font-mono text-foreground">OPENAI_API_KEY</span> or{" "}
        <span className="font-mono text-foreground">ANTHROPIC_API_KEY</span> to
        unlock Ask, Scout, Compare, roster review, a news briefing, and injury
        analysis. The top-5 board still works without a key.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/25 bg-panel">
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Coach</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
          {busy ? "Thinking" : "On"}
        </span>
      </div>

      {state.coachNote ? (
        <p className="border-b border-panel-border bg-accent-dim px-4 py-3 text-sm leading-6">
          {state.coachNote}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 px-4 py-3">
        <CoachButton
          disabled={busy}
          onClick={() => void run({ nonce: Date.now(), action: "review" })}
        >
          Review roster
        </CoachButton>
        <CoachButton
          disabled={busy || state.stories.length === 0}
          onClick={() => void run({ nonce: Date.now(), action: "briefing" })}
        >
          News briefing
        </CoachButton>
        <CoachButton
          disabled={busy}
          onClick={() => void run({ nonce: Date.now(), action: "board" })}
        >
          Sleepers & fades
        </CoachButton>
        <CoachButton
          disabled={busy}
          onClick={() => void run({ nonce: Date.now(), action: "injury" })}
        >
          Injury analysis
        </CoachButton>
        <CoachButton
          disabled={busy}
          pressed={compareMode}
          onClick={onToggleCompare}
        >
          Compare
        </CoachButton>
      </div>

      {compareMode ? (
        <div className="flex flex-col gap-2 border-t border-panel-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted">
            {selectedNames.length === 0
              ? "Click two players on the recs or remaining board."
              : `Selected: ${selectedNames.join(" vs ")}`}
          </p>
          <div className="flex gap-2">
            <CoachButton
              disabled={busy || selectedIds.length !== 2}
              onClick={onCompareSelected}
            >
              Compare selected
            </CoachButton>
            {selectedIds.length > 0 ? (
              <CoachButton disabled={busy} onClick={onClearCompare}>
                Clear
              </CoachButton>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="px-4 pb-3 text-sm text-rose-300">{error}</p>
      ) : null}

      {result ? (
        <div className="border-t border-panel-border px-4 py-3">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            {result.title}
          </p>
          <p className="text-sm leading-6">{result.note}</p>
        </div>
      ) : null}

      <form
        onSubmit={onAsk}
        className="flex flex-col gap-2 border-t border-panel-border px-4 py-3"
      >
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about this board…"
            maxLength={400}
            className="h-9 flex-1 rounded-md border border-panel-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            Ask
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => {
                setQuestion(chip);
                void run({ nonce: Date.now(), action: "ask", question: chip });
              }}
              className="rounded-full border border-panel-border px-2.5 py-1 text-left text-[12px] text-muted transition hover:border-accent/40 hover:text-foreground disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}

function CoachButton({
  children,
  onClick,
  disabled,
  pressed,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
        pressed
          ? "border-accent/50 bg-accent-dim text-accent"
          : "border-panel-border bg-background text-foreground hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );
}
