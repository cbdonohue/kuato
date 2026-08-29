import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-10 sm:py-16">
      <header className="mb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Live redraft
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-4 text-base leading-7 text-muted">
          This draft assistant is password-protected.
        </p>
      </header>
      <LoginForm />
    </div>
  );
}
