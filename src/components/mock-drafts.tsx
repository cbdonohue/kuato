"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";

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

function emptyStored(): Stored {
  return { username: "", draftIds: "" };
}

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStored();
    const parsed = JSON.parse(raw) as Stored;
    return {
      username: parsed.username ?? "",
      draftIds: parsed.draftIds ?? "",
    };
  } catch {
    return emptyStored();
  }
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function MockDrafts() {
  const isClient = useIsClient();
  if (!isClient) {
    return <p className="text-sm text-muted">Loading saved IDs…</p>;
  }
  return <MockDraftsForm />;
}

function MockDraftsForm() {
  const stored = readStored();
  const [username, setUsername] = useState(stored.username);
  const [draftIds, setDraftIds] = useState(stored.draftIds);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username, draftIds } satisfies Stored),
    );
  }, [username, draftIds]);

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

  return (
    <div className="flex flex-col gap-8">
      <details className="rounded-xl border border-panel-border bg-panel px-5 py-4">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
          How to get a mock draft ID
        </summary>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 text-muted">
          <li>On sleeper.com, start or join a mock draft (web is easiest).</li>
          <li>
            Open the lobby or board. The URL looks like{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[13px] text-foreground">
              sleeper.com/draft/nfl/1399455372749582336
            </code>
          </li>
          <li>
            Copy the long number after{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[13px] text-foreground">
              /draft/nfl/
            </code>{" "}
            — that is the draft ID.
          </li>
          <li>
            Paste it below with the Sleeper username you joined as so the room
            can find your seat.
          </li>
        </ol>
      </details>

      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.16em] text-muted">
          Sleeper username
        </span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username you joined the mock with"
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
          rows={5}
          className="rounded-lg border border-panel-border bg-panel px-4 py-3 font-mono text-sm outline-none ring-accent/40 placeholder:text-muted focus:ring-2"
        />
      </label>

      {ids.length === 0 ? (
        <p className="rounded-lg border border-panel-border bg-panel px-4 py-6 text-sm text-muted">
          Save a Sleeper mock draft ID, then open the live room. IDs stay in
          this browser.
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
