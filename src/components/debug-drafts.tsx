"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "football-debug-drafts";

type Stored = {
  username: string;
  draftIds: string;
};

function parseDraftIds(text: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const line of text.split("\n")) {
    const id = line.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function roomHref(draftId: string, username: string): string {
  return `/draft/${encodeURIComponent(draftId)}?username=${encodeURIComponent(username)}`;
}

export function DebugDrafts() {
  const [username, setUsername] = useState("");
  const [draftIds, setDraftIds] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        setUsername(parsed.username ?? "");
        setDraftIds(parsed.draftIds ?? "");
      }
    } catch {
      // ignore bad local storage
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username, draftIds } satisfies Stored),
    );
  }, [username, draftIds, ready]);

  const ids = useMemo(() => parseDraftIds(draftIds), [draftIds]);
  const handle = username.trim();

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("draftId") as HTMLInputElement;
    const next = input.value.trim();
    if (!next) return;
    setDraftIds((current) => {
      const existing = parseDraftIds(current);
      if (existing.includes(next)) return current;
      return existing.length ? `${current.replace(/\s+$/, "")}\n${next}` : next;
    });
    input.value = "";
  }

  if (!ready) {
    return <p className="text-sm text-muted">Loading saved IDs…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.16em] text-muted">
          Sleeper username
        </span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Your Sleeper username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 rounded-lg border border-panel-border bg-panel px-4 text-base outline-none ring-accent/40 placeholder:text-muted focus:ring-2"
        />
      </label>

      <form onSubmit={onAdd} className="flex flex-col gap-3 sm:flex-row">
        <input
          name="draftId"
          placeholder="Mock draft ID"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 flex-1 rounded-lg border border-panel-border bg-panel px-4 font-mono text-base outline-none ring-accent/40 placeholder:text-muted focus:ring-2"
        />
        <button
          type="submit"
          className="h-12 rounded-lg bg-accent px-5 font-semibold text-black"
        >
          Save ID
        </button>
      </form>

      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.16em] text-muted">
          Saved mock draft IDs
        </span>
        <textarea
          value={draftIds}
          onChange={(event) => setDraftIds(event.target.value)}
          placeholder={"One Sleeper draft ID per line\n123456789012345678"}
          rows={6}
          className="rounded-lg border border-panel-border bg-panel px-4 py-3 font-mono text-sm outline-none ring-accent/40 placeholder:text-muted focus:ring-2"
        />
      </label>

      {ids.length === 0 ? (
        <p className="rounded-lg border border-panel-border bg-panel px-4 py-6 text-sm text-muted">
          Paste or save a Sleeper mock draft ID, then open the live room. IDs
          stay in this browser.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ids.map((id) => (
            <li
              key={id}
              className="flex flex-col gap-3 rounded-xl border border-panel-border bg-panel px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="break-all font-mono text-sm">{id}</p>
              {handle ? (
                <Link
                  href={roomHref(id, handle)}
                  className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black"
                >
                  Open room
                </Link>
              ) : (
                <span className="text-sm text-muted">Username required</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
