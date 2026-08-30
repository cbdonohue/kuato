import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppNav } from "./app-nav";

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

describe("AppNav", () => {
  it("links home and offers sign out", () => {
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Kuato" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
