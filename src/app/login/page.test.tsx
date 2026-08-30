import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

vi.mock("./login-form", () => ({
  LoginForm: () => <form aria-label="sign-in" />,
}));

describe("Login page", () => {
  it("renders the sign-in heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Kuato")).toBeInTheDocument();
    expect(screen.getByLabelText("sign-in")).toBeInTheDocument();
  });
});
