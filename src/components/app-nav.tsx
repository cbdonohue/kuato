import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

export function AppNav({ current }: { current?: "home" | "debug" }) {
  const linkClass = (page: "home" | "debug") =>
    `text-sm transition ${
      current === page
        ? "text-foreground"
        : "text-muted hover:text-foreground"
    }`;

  return (
    <div className="mb-6 flex items-center justify-end gap-4">
      <Link href="/" className={linkClass("home")}>
        Home
      </Link>
      <Link href="/debug" className={linkClass("debug")}>
        Debug
      </Link>
      <SignOutButton />
    </div>
  );
}
