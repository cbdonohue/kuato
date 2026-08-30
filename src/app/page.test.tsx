import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

describe("Home page", () => {
  it("renders the drafts tab by default", async () => {
    render(await Home({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: "Kuato" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Sleeper username")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your drafts" })).toHaveClass("bg-accent");
  });

  it("renders the mock tab when requested", async () => {
    render(await Home({ searchParams: Promise.resolve({ tab: "mock" }) }));
    expect(screen.getByRole("link", { name: "Mock draft" })).toHaveClass("bg-accent");
    expect(
      await screen.findByText(/Save a Sleeper mock draft ID/),
    ).toBeInTheDocument();
  });
});
