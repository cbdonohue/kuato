import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeSearch } from "./home-search";

describe("HomeSearch", () => {
  it("does nothing when the username is blank", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<HomeSearch />);
    await user.click(screen.getByRole("button", { name: "Find drafts" }));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("lists drafts after a successful lookup", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { user_id: "u1", username: "brian", display_name: "Brian" },
          season: "2026",
          drafts: [
            {
              draftId: "d1",
              name: "Home League",
              teams: 12,
              rounds: 15,
              scoringType: "ppr",
              type: "snake",
              status: "drafting",
            },
            {
              draftId: "d2",
              name: "Finished",
              teams: 10,
              rounds: 15,
              scoringType: "std",
              type: "linear",
              status: "mystery",
            },
          ],
        }),
      }),
    );

    render(<HomeSearch />);
    await user.type(screen.getByPlaceholderText("Sleeper username"), "brian");
    await user.click(screen.getByRole("button", { name: "Find drafts" }));

    expect(await screen.findByRole("heading", { name: "Brian" })).toBeInTheDocument();
    expect(screen.getByText("2 drafts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home League/ })).toHaveAttribute(
      "href",
      "/draft/d1?username=brian",
    );
    expect(screen.getByText("drafting")).toBeInTheDocument();
    expect(screen.getByText("mystery")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows an empty-season message when there are no drafts", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { user_id: "u1", username: "brian", display_name: "Brian" },
          season: "2026",
          drafts: [],
        }),
      }),
    );
    render(<HomeSearch />);
    await user.type(screen.getByPlaceholderText("Sleeper username"), "brian");
    await user.click(screen.getByRole("button", { name: "Find drafts" }));
    expect(
      await screen.findByText("No NFL drafts found for this season."),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("surfaces API and network errors", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "No Sleeper user named \"ghost\"" }),
      }),
    );
    const { unmount } = render(<HomeSearch />);
    await user.type(screen.getByPlaceholderText("Sleeper username"), "ghost");
    await user.click(screen.getByRole("button", { name: "Find drafts" }));
    expect(
      await screen.findByText('No Sleeper user named "ghost"'),
    ).toBeInTheDocument();
    unmount();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<HomeSearch />);
    await user.type(screen.getByPlaceholderText("Sleeper username"), "brian");
    await user.click(screen.getByRole("button", { name: "Find drafts" }));
    expect(
      await screen.findByText("Network error talking to Sleeper"),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
