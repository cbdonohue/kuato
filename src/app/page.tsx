import { HomeSearch } from "@/components/home-search";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Live redraft
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Sleeper draft assistant
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Look up a Sleeper username, open a draft, and get next-pick
          recommendations from the board, your roster holes, and positional
          scarcity. Sleeper stays read-only — you still make the pick in-app.
        </p>
      </header>
      <HomeSearch />
    </div>
  );
}
