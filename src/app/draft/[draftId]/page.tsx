import { LiveRoom } from "@/components/live-room";
import Link from "next/link";

export default async function DraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ username?: string | string[] }>;
}) {
  const { draftId } = await params;
  const query = await searchParams;
  const username = typeof query.username === "string" ? query.username : "";

  if (!username) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <p className="text-muted">
          A Sleeper username is required to open a live room.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-accent">
          Look up a username
        </Link>
      </div>
    );
  }

  return <LiveRoom draftId={draftId} username={username} />;
}
