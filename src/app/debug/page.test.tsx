import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { redirect } from "next/navigation";
import DebugPage from "./page";

describe("Debug page", () => {
  it("redirects to the mock tab", () => {
    DebugPage();
    expect(redirect).toHaveBeenCalledWith("/?tab=mock");
  });
});
