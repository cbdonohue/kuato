import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignOutButton } from "./sign-out-button";

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

describe("SignOutButton", () => {
  it("renders a sign-out submit button", () => {
    render(<SignOutButton />);
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
