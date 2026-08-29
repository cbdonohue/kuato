import { AppNav } from "@/components/app-nav";
import { DebugDrafts } from "@/components/debug-drafts";

export default function DebugPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 sm:py-16">
      <AppNav current="debug" />
      <header className="mb-10 max-w-2xl">
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
      <div className="mx-auto w-full max-w-3xl">
        <DebugDrafts />
      </div>
    </div>
  );
}
