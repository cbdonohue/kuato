"use client";

import { BrandLink } from "@/components/brand";
import { CoachPanel, type AiTrigger } from "@/components/coach-panel";
import { PositionBadge } from "@/components/position-badge";
import { SignOutButton } from "@/components/sign-out-button";
import type { DraftStory, LiveState, PlayerView } from "@/lib/types";
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

function formatAdp(value: number | null, fallback: number): string {
  const n = value ?? fallback;
  if (n >= 100) return String(Math.round(n));
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function adpDelta(pickNo: number, adp: number | null): string | null {
  if (adp == null) return null;
  const delta = pickNo - adp;
  if (Math.abs(delta) < 0.5) return null;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}

function recMeta(player: PlayerView, pickNo: number): string {
  const bits: string[] = [];
  if (player.adp != null) {
    bits.push(`ADP ${formatAdp(player.adp, player.rank)}`);
    const delta = adpDelta(pickNo, player.adp);
    if (delta) bits.push(`Δ ${delta}`);
  } else {
    bits.push(`Rank ${player.sleeperRank >= 9999 ? "—" : player.sleeperRank}`);
  }
  bits.push(player.team);
  if (player.byeWeek != null) bits.push(`bye ${player.byeWeek}`);
  if (player.injuryStatus) bits.push(player.injuryStatus);
  if (player.depth) bits.push(player.depth);
  if (player.rookie) bits.push("Rookie");
  else if (player.yearsExp != null) bits.push(`${player.yearsExp} yr`);
  else if (player.age != null) bits.push(`${player.age}y`);
  return bits.join(" · ");
}

function lastSeasonLine(player: PlayerView): string | null {
  const ly = player.lastSeason;
  if (!ly) return null;
  const bits = [`${ly.season} · ${ly.fantasyPts.toFixed(0)} pts`];
  if (ly.snapPct != null) bits.push(`${ly.snapPct}% snaps`);
  bits.push(`${ly.games}g`);
  if (ly.line) bits.push(ly.line);
  return bits.join(" · ");
}

function newsSourceHref(source: string): string {
  return source === "ESPN" ? "https://www.espn.com" : "https://news.google.com";
}

function NewsStories({ stories }: { stories: DraftStory[] }) {
  return (
    <section className="rounded-xl border border-panel-border bg-panel">
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">News</h2>
        <span className="font-mono text-xs text-muted">
          {stories.length} {stories.length === 1 ? "story" : "stories"}
        </span>
      </div>
      <ul className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {stories.map((story) => {
          const meta = [story.source, story.age].filter(Boolean).join(" · ");
          const body = (
            <>
              <div className="mb-2 flex items-center gap-2">
                <PositionBadge position={story.position} />
                <span className="truncate text-sm font-medium">
                  {story.playerName}
                </span>
              </div>
              <p className="line-clamp-3 text-sm leading-5">{story.headline}</p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wide text-muted">
                {meta}
              </p>
            </>
          );
          const className =
            "block h-full rounded-lg border border-panel-border bg-background px-4 py-3";
          return (
            <li key={`${story.playerId}-${story.headline}`} className="min-w-0">
              {story.url ? (
                <a
                  href={story.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${className} transition hover:border-accent/40`}
                >
                  {body}
                </a>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [aiTrigger, setAiTrigger] = useState<AiTrigger | null>(null);

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

  const selectedNames = useMemo(() => {
    if (!state) return [];
    return selectedIds
      .map((id) => {
        const fromRec = state.recommendations.find((rec) => rec.player.playerId === id);
        if (fromRec) return fromRec.player.name;
        const fromBoard = state.available.find((player) => player.playerId === id);
        if (fromBoard) return fromBoard.name;
        const fromRoster = state.roster.find((slot) => slot.player?.playerId === id);
        return fromRoster?.player?.name ?? id;
      });
  }, [state, selectedIds]);

  function scoutPlayer(playerId: string) {
    if (compareMode) {
      toggleSelected(playerId);
      return;
    }
    setAiTrigger({ nonce: Date.now(), action: "scout", playerId });
  }

  function toggleSelected(playerId: string) {
    setSelectedIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      if (current.length >= 2) return [current[1], playerId];
      return [...current, playerId];
    });
  }

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
            <BrandLink />
            <Link
              href="/?tab=mock"
              className="text-xs uppercase tracking-[0.18em] text-muted"
            >
              Mock
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

      {state.stories?.length ? <NewsStories stories={state.stories} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="flex flex-col gap-4">
          <CoachPanel
            draftId={draftId}
            username={username}
            state={state}
            trigger={aiTrigger}
            compareMode={compareMode}
            selectedIds={selectedIds}
            selectedNames={selectedNames}
            onToggleCompare={() => {
              setCompareMode((current) => !current);
              if (compareMode) setSelectedIds([]);
            }}
            onClearCompare={() => setSelectedIds([])}
            onCompareSelected={() => {
              if (selectedIds.length !== 2) return;
              setAiTrigger({
                nonce: Date.now(),
                action: "compare",
                playerIds: selectedIds,
              });
            }}
          />

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
                {state.recommendations.map((rec, index) => {
                  const ly = lastSeasonLine(rec.player);
                  return (
                  <li
                    key={rec.player.playerId}
                    className={`flex flex-col gap-2 px-4 py-3 ${
                      selectedIds.includes(rec.player.playerId) ? "bg-accent-dim/60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-sm text-muted">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{rec.player.name}</p>
                          <p className="text-xs text-muted">
                            {recMeta(rec.player, state.clock.pickNo)}
                          </p>
                          {ly ? <p className="text-xs text-muted">{ly}</p> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {state.aiEnabled ? (
                          <PlayerAction
                            label={compareMode ? "Select" : "Scout"}
                            selected={selectedIds.includes(rec.player.playerId)}
                            onClick={() => scoutPlayer(rec.player.playerId)}
                          />
                        ) : null}
                        <PositionBadge position={rec.player.position} />
                      </div>
                    </div>
                    <p className="text-xs text-muted">{rec.reasons.join(" · ")}</p>
                  </li>
                  );
                })}
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
            <AvailableList
              players={filtered}
              aiEnabled={state.aiEnabled}
              compareMode={compareMode}
              selectedIds={selectedIds}
              onScout={scoutPlayer}
            />
          </div>
        </section>
      </div>
      <p className="pb-2 text-xs text-muted">
        ADP from{" "}
        <a
          href="https://fantasyfootballcalculator.com"
          className="text-accent underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Fantasy Football Calculator
        </a>
        . Stats from{" "}
        <a
          href="https://github.com/nflverse"
          className="text-accent underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          nflverse
        </a>
        .
        {state.newsSources?.length ? (
          <>
            {" "}
            Headlines from{" "}
            {state.newsSources.map((source, index) => (
              <span key={source}>
                {index > 0 ? " and " : null}
                <a
                  href={newsSourceHref(source)}
                  className="text-accent underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {source}
                </a>
              </span>
            ))}
            .
          </>
        ) : null}
      </p>
    </div>
  );
}

function AvailableList({
  players,
  aiEnabled,
  compareMode,
  selectedIds,
  onScout,
}: {
  players: PlayerView[];
  aiEnabled: boolean;
  compareMode: boolean;
  selectedIds: string[];
  onScout: (playerId: string) => void;
}) {
  if (players.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">No matching players.</p>;
  }
  return (
    <ul className="max-h-[32rem] divide-y divide-panel-border overflow-auto">
      <li className="sticky top-0 flex items-center gap-3 bg-panel px-4 py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted">
        <span className="w-10">ADP</span>
        <span className="flex-1">Player</span>
        <span className="w-8 text-right">Bye</span>
        <span className="w-10 text-right">LY</span>
        <span className="w-16" />
        <span className="w-10" />
      </li>
      {players.map((player) => (
        <li
          key={player.playerId}
          className={`flex items-start justify-between gap-3 px-4 py-2 text-sm ${
            selectedIds.includes(player.playerId) ? "bg-accent-dim/60" : ""
          }`}
        >
          <span className="w-10 font-mono text-xs text-muted">
            {formatAdp(player.adp, player.rank)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              {player.name}{" "}
              <span className="text-muted">{player.team}</span>
            </span>
            {player.depth || player.rookie ? (
              <span className="block text-[11px] text-muted">
                {[player.depth, player.rookie ? "Rookie" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </span>
          <span className="w-8 text-right font-mono text-xs text-muted">
            {player.byeWeek ?? "—"}
          </span>
          <span className="w-10 text-right font-mono text-xs text-muted">
            {player.lastSeason ? player.lastSeason.fantasyPts.toFixed(0) : "—"}
          </span>
          {aiEnabled ? (
            <PlayerAction
              label={compareMode ? "Select" : "Scout"}
              selected={selectedIds.includes(player.playerId)}
              onClick={() => onScout(player.playerId)}
            />
          ) : (
            <span className="w-16" />
          )}
          <PositionBadge position={player.position} />
        </li>
      ))}
    </ul>
  );
}

function PlayerAction({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-16 shrink-0 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition ${
        selected
          ? "border-accent/50 bg-accent-dim text-accent"
          : "border-panel-border text-muted hover:border-accent/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
