import { BrandLink } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

export function AppNav() {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <BrandLink />
      <SignOutButton />
    </div>
  );
}
