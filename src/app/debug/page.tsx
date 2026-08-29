import { AppNav } from "@/components/app-nav";
import { DebugDrafts } from "@/components/debug-drafts";

export default function DebugPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 sm:py-16">
      <AppNav current="debug" />
      <header className="mb-8 max-w-2xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Debug
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Mock draft IDs
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Skip the username lookup and open a Sleeper mock (or real) draft by
          ID. Use the same username you joined the mock with so the room can
          find your seat.
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <section className="rounded-xl border border-panel-border bg-panel px-5 py-5">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            How to get a mock draft ID
          </p>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 text-muted">
            <li>
              On sleeper.com, start or join a mock draft (web is easiest).
            </li>
            <li>
              Open the draft lobby or board. The URL looks like{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[13px] text-foreground">
                sleeper.com/draft/nfl/1399455372749582336
              </code>
            </li>
            <li>
              Copy the long number after{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[13px] text-foreground">
                /draft/nfl/
              </code>
              {" "}
              — that is the draft ID.
            </li>
            <li>
              On the app, share the mock and copy the link — the same ID is in
              the URL. Paste it below with the username you joined as.
            </li>
          </ol>
        </section>
        <DebugDrafts />
      </div>
    </div>
  );
}
