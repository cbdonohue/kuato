import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "./login-form";

vi.mock("./actions", () => ({
  login: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [{ error: "Wrong password." }, vi.fn(), true],
  };
});

describe("LoginForm", () => {
  it("shows the pending label and an error", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(screen.getByText("Wrong password.")).toBeInTheDocument();
  });
});
