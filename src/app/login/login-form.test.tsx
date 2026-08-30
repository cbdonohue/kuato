import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

vi.mock("./actions", () => ({
  login: vi.fn(),
}));

const loginState = vi.hoisted(() => ({
  value: [{ error: "Wrong password." }, vi.fn(), true] as [
    { error?: string } | undefined,
    () => void,
    boolean,
  ],
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => loginState.value,
  };
});

describe("LoginForm", () => {
  it("shows the pending label and an error", () => {
    loginState.value = [{ error: "Wrong password." }, vi.fn(), true];
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(screen.getByText("Wrong password.")).toBeInTheDocument();
  });

  it("shows Sign in when idle with no error", () => {
    loginState.value = [undefined, vi.fn(), false];
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.queryByText("Wrong password.")).not.toBeInTheDocument();
  });
});
