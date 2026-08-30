import { LoginForm } from "@/app/login/login-form";
import { BrandMark } from "@/components/brand";

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-10 sm:py-16">
      <header className="mb-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={56} />
          <span className="text-lg font-semibold tracking-tight">Kuato</span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Kuato is password-protected.
        </p>
      </header>
      <LoginForm />
    </div>
  );
}
