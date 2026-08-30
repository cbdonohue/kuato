import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockDrafts } from "./mock-drafts";

afterEach(() => {
  localStorage.clear();
});

describe("MockDrafts", () => {
  it("loads saved IDs and opens a room when a username is set", async () => {
    localStorage.setItem(
      "football-debug-drafts",
      JSON.stringify({ username: "brian", draftIds: "111\n111\n\n222" }),
    );
    render(<MockDrafts />);
    expect(await screen.findByDisplayValue("brian")).toBeInTheDocument();
    expect(screen.getByText("111")).toBeInTheDocument();
    expect(screen.getByText("222")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open room" })[0]).toHaveAttribute(
      "href",
      "/draft/111?username=brian",
    );
  });

  it("shows the empty state and requires a username", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    render(<MockDrafts />);
    expect(
      await screen.findByText(/Save a Sleeper mock draft ID/),
    ).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText("Mock draft ID"),
      "999888777",
    );
    await user.click(screen.getByRole("button", { name: "Save ID" }));
    expect(await screen.findByText("Username required")).toBeInTheDocument();
    expect(screen.getAllByText("999888777").length).toBeGreaterThan(0);
  });

  it("ignores blank or duplicate IDs and survives bad localStorage", async () => {
    localStorage.setItem("football-debug-drafts", "{not-json");
    const user = userEvent.setup();
    render(<MockDrafts />);
    expect(await screen.findByPlaceholderText("Mock draft ID")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save ID" }));
    expect(screen.queryByRole("link", { name: "Open room" })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Mock draft ID"), "abc");
    await user.click(screen.getByRole("button", { name: "Save ID" }));
    expect(await screen.findByText("Username required")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Mock draft ID"), "abc");
    await user.click(screen.getByRole("button", { name: "Save ID" }));
    expect(screen.getAllByText("abc")).toHaveLength(2);
  });
});
