import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

export function AppNav() {
  return (
    <div className="mb-6 flex items-center justify-end gap-4">
      <Link
        href="/"
        className="text-sm text-muted transition hover:text-foreground"
      >
        Home
      </Link>
      <SignOutButton />
    </div>
  );
}
