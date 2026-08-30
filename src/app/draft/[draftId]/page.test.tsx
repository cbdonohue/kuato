import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DraftPage from "./page";

vi.mock("@/components/live-room", () => ({
  LiveRoom: ({ draftId, username }: { draftId: string; username: string }) => (
    <div>{`room ${draftId} ${username}`}</div>
  ),
}));

describe("Draft page", () => {
  it("asks for a username when it is missing", async () => {
    render(
      await DraftPage({
        params: Promise.resolve({ draftId: "d1" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByText("A Sleeper username is required to open a live room."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Look up a username" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("opens the live room when a username is present", async () => {
    render(
      await DraftPage({
        params: Promise.resolve({ draftId: "d1" }),
        searchParams: Promise.resolve({ username: "brian" }),
      }),
    );
    expect(screen.getByText("room d1 brian")).toBeInTheDocument();
  });
});
