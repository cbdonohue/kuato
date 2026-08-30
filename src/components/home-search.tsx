"use client";

import type { DraftListItem, SleeperUser } from "@/lib/types";
import Link from "next/link";
import { FormEvent, useState } from "react";

const STATUS_STYLE: Record<string, string> = {
  drafting: "bg-accent/15 text-accent",
  pre_draft: "bg-sky-400/15 text-sky-300",
  complete: "bg-white/10 text-zinc-400",
};

export function HomeSearch() {
  const [username, setUsername] = useState("");
  const [season, setSeason] = useState<string | null>(null);
  const [user, setUser] = useState<SleeperUser | null>(null);
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const handle = username.trim();
    if (!handle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(handle)}/drafts`);
      const data = await res.json();
      if (!res.ok) {
        setUser(null);
        setDrafts([]);
        setError(data.error || "Could not load drafts");
        return;
      }
      setUser(data.user);
      setSeason(data.season);
      setDrafts(data.drafts);
    } catch {
      setError("Network error talking to Sleeper");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Sleeper username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 flex-1 rounded-lg border border-panel-border bg-panel px-4 text-base outline-none ring-accent/40 placeholder:text-muted focus:ring-2"
        />
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="h-12 rounded-lg bg-accent px-5 font-semibold text-black disabled:opacity-40"
        >
          {loading ? "Looking up…" : "Find drafts"}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {user ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted">
                {season} season
              </p>
              <h2 className="text-xl font-semibold">{user.display_name}</h2>
              <p className="text-sm text-muted">@{user.username}</p>
            </div>
            <p className="font-mono text-sm text-muted">{drafts.length} drafts</p>
          </div>

          {drafts.length === 0 ? (
            <p className="rounded-lg border border-panel-border bg-panel px-4 py-6 text-sm text-muted">
              No NFL drafts found for this season.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {drafts.map((draft) => (
                <li key={draft.draftId}>
                  <Link
                    href={`/draft/${draft.draftId}?username=${encodeURIComponent(user.username)}`}
                    className="flex flex-col gap-2 rounded-xl border border-panel-border bg-panel px-4 py-4 transition hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{draft.name}</p>
                      <p className="text-sm text-muted">
                        {draft.teams}tm · {draft.rounds}rd · {draft.scoringType} ·{" "}
                        {draft.type}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLE[draft.status] ?? STATUS_STYLE.complete}`}
                    >
                      {draft.status.replace("_", " ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
