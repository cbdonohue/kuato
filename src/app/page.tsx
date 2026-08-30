import { AppNav } from "@/components/app-nav";
import { HomeSearch } from "@/components/home-search";
import { MockDrafts } from "@/components/mock-drafts";
import Link from "next/link";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const query = await searchParams;
  const tab = query.tab === "mock" ? "mock" : "drafts";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-10 sm:py-16">
      <AppNav />
      <header className="mb-10 max-w-2xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Live redraft
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Sleeper draft assistant
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Look up a Sleeper username or open a mock by draft ID. You get
          next-pick recommendations from the board, your roster holes, and who
          still needs the position. With an AI key you can ask the coach, scout
          a player, or compare two names. Sleeper stays read-only — you still
          make the pick in-app.
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-panel-border bg-panel p-1">
          <Link
            href="/"
            className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
              tab === "drafts"
                ? "bg-accent text-black"
                : "text-muted hover:text-foreground"
            }`}
          >
            Your drafts
          </Link>
          <Link
            href="/?tab=mock"
            className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
              tab === "mock"
                ? "bg-accent text-black"
                : "text-muted hover:text-foreground"
            }`}
          >
            Mock draft
          </Link>
        </div>
        {tab === "mock" ? <MockDrafts /> : <HomeSearch />}
      </div>
    </div>
  );
}
