"use client";

import { PositionBadge } from "@/components/position-badge";
import { SignOutButton } from "@/components/sign-out-button";
import type { LiveState, PlayerView } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const POLL_MS = 2000;

function clockLabel(state: LiveState): string {
  if (state.draft.status === "complete" || state.clock.picksUntilUser === null) {
    if (state.clock.pickNo >= state.clock.totalPicks) return "Draft complete";
  }
  if (state.clock.onTheClock?.isYou) return "You're on the clock";
  if (state.clock.picksUntilUser === 1) return "You're up next";
  if (state.clock.picksUntilUser != null) {
    return `Your pick in ${state.clock.picksUntilUser}`;
  }
  return "Waiting on draft order";
}

function scoreChip(label: string, value: number) {
  return (
    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted">
      {label} {value.toFixed(1)}
    </span>
  );
}

export function LiveRoom({
  draftId,
  username,
}: {
  draftId: string;
  username: string;
}) {
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch(
          `/api/drafts/${draftId}/live?username=${encodeURIComponent(username)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Failed to load draft");
        } else {
          setState(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) {
          timer = setTimeout(load, POLL_MS);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [draftId, username]);

  const filtered = useMemo(() => {
    if (!state) return [];
    const q = query.trim().toLowerCase();
    return state.available.filter((player) => {
      if (position !== "ALL" && player.position !== position) return false;
      if (!q) return true;
      return (
        player.name.toLowerCase().includes(q) ||
        player.team.toLowerCase().includes(q)
      );
    });
  }, [state, query, position]);

  if (error && !state) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <p className="text-rose-300">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-accent">
          Back to lookup
        </Link>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        Loading draft board…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-panel-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs uppercase tracking-[0.18em] text-muted">
              All drafts
            </Link>
            <SignOutButton />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {state.draft.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {state.leagueName} · {state.draft.teams}tm · {state.draft.scoringType}
            {state.draft.isSuperflex ? " · Superflex" : ""} · @{state.user.username}
          </p>
        </div>
        <div
          className={`rounded-xl border px-4 py-3 ${
            state.clock.onTheClock?.isYou
              ? "border-accent/40 bg-accent-dim"
              : "border-panel-border bg-panel"
          }`}
        >
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Pick {state.clock.pickNo} / {state.clock.totalPicks} · R{state.clock.round}
          </p>
          <p className="text-lg font-semibold">{clockLabel(state)}</p>
          {state.clock.onTheClock && !state.clock.onTheClock.isYou ? (
            <p className="text-sm text-muted">
              On the clock: {state.clock.onTheClock.displayName}
            </p>
          ) : null}
        </div>
      </header>

      {state.unsupported ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {state.unsupported === "auction"
            ? "Auction drafts are not scored in this MVP. Recommendations are hidden."
            : "Dynasty leagues are not scored in this MVP. Recommendations are hidden."}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-300">Refresh issue: {error}</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="flex flex-col gap-4">
          {state.coachNote ? (
            <div className="rounded-xl border border-accent/25 bg-accent-dim px-4 py-3 text-sm leading-6">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                Coach
              </p>
              {state.coachNote}
            </div>
          ) : null}

          <div className="rounded-xl border border-panel-border bg-panel">
            <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Top recommendations
              </h2>
              <span className="font-mono text-xs text-muted">
                {state.recommendations.length} players
              </span>
            </div>
            {state.recommendations.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted">
                {state.unsupported
                  ? "No recommendations for this draft type."
                  : "No remaining players to recommend."}
              </p>
            ) : (
              <ol className="divide-y divide-panel-border">
                {state.recommendations.map((rec, index) => (
                  <li key={rec.player.playerId} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-sm text-muted">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{rec.player.name}</p>
                          <p className="text-xs text-muted">
                            ADP/rank {rec.player.rank} · {rec.player.team}
                            {rec.player.injuryStatus
                              ? ` · ${rec.player.injuryStatus}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PositionBadge position={rec.player.position} />
                        <span className="font-mono text-sm text-accent">
                          {rec.scores.total.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {scoreChip("value", rec.scores.value)}
                      {scoreChip("need", rec.scores.need)}
                      {scoreChip("scarce", rec.scores.scarcity)}
                      {scoreChip("window", rec.scores.window)}
                    </div>
                    <p className="text-xs text-muted">{rec.reasons.join(" · ")}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-xl border border-panel-border bg-panel">
            <h2 className="border-b border-panel-border px-4 py-3 text-sm font-semibold uppercase tracking-wide">
              Your roster
            </h2>
            <ul className="divide-y divide-panel-border">
              {state.roster.map((entry, index) => (
                <li
                  key={`${entry.slot}-${index}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <PositionBadge position={entry.slot} />
                  {entry.player ? (
                    <span className="flex-1 text-sm">
                      {entry.player.name}{" "}
                      <span className="text-muted">{entry.player.team}</span>
                    </span>
                  ) : (
                    <span className="flex-1 text-sm text-muted">Empty</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-xl border border-panel-border bg-panel">
            <h2 className="border-b border-panel-border px-4 py-3 text-sm font-semibold uppercase tracking-wide">
              Recent picks
            </h2>
            {state.recentPicks.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No picks yet.</p>
            ) : (
              <ul className="divide-y divide-panel-border">
                {state.recentPicks.map((pick) => (
                  <li
                    key={pick.pickNo}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="font-mono text-xs text-muted">
                      {pick.pickNo}
                    </span>
                    <span className="flex-1">
                      {pick.player.name}{" "}
                      <span className="text-muted">
                        {pick.isYou ? "you" : pick.pickedByName}
                      </span>
                    </span>
                    <PositionBadge position={pick.player.position} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-panel-border bg-panel">
            <div className="flex flex-col gap-3 border-b border-panel-border px-4 py-3 sm:flex-row sm:items-center">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Remaining board
              </h2>
              <div className="flex flex-1 gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search players"
                  className="h-9 flex-1 rounded-md border border-panel-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                />
                <select
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  className="h-9 rounded-md border border-panel-border bg-background px-2 text-sm"
                >
                  {["ALL", "QB", "RB", "WR", "TE", "K", "DEF"].map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <AvailableList players={filtered} />
          </div>
        </section>
      </div>
    </div>
  );
}

function AvailableList({ players }: { players: PlayerView[] }) {
  if (players.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">No matching players.</p>;
  }
  return (
    <ul className="max-h-[32rem] divide-y divide-panel-border overflow-auto">
      {players.map((player) => (
        <li
          key={player.playerId}
          className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
        >
          <span className="font-mono w-8 text-xs text-muted">{player.rank}</span>
          <span className="flex-1">
            {player.name}{" "}
            <span className="text-muted">{player.team}</span>
          </span>
          <PositionBadge position={player.position} />
        </li>
      ))}
    </ul>
  );
}
