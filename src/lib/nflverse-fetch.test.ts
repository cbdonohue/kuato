import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./cache", () => ({
  fetchText: vi.fn(),
  loadDayCache: vi.fn(async (_name: string, loader: () => Promise<unknown>) => loader()),
}));

import { fetchText, loadDayCache } from "./cache";
import { EMPTY_NFLVERSE, getNflverseSeason } from "./nflverse";

const statsCsv = `player_id,player_name,position,games,passing_yards,passing_tds,passing_interceptions,rushing_yards,rushing_tds,receptions,receiving_yards,receiving_tds,fantasy_points,fantasy_points_ppr
00-0032764,D.Henry,RB,17,0,0,0,1921,16,20,150,1,300,320
`;

afterEach(() => {
  vi.mocked(fetchText).mockReset();
  vi.mocked(loadDayCache).mockImplementation(async (_name, loader) => loader());
});

describe("getNflverseSeason fetch", () => {
  it("assembles the current season when stats are available", async () => {
    vi.mocked(fetchText)
      .mockResolvedValueOnce(statsCsv)
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("");

    const bundle = await getNflverseSeason(2025);
    expect(bundle.season).toBe(2025);
    expect(bundle.byGsis["00-0032764"]?.fantasyPpr).toBe(320);
  });

  it("falls back to the previous season when the current stats file is missing", async () => {
    vi.mocked(fetchText)
      .mockRejectedValueOnce(new Error("404"))
      .mockResolvedValueOnce(statsCsv)
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("");

    const bundle = await getNflverseSeason(2026);
    expect(bundle.season).toBe(2025);
  });

  it("returns the empty bundle when every fetch fails", async () => {
    vi.mocked(fetchText).mockRejectedValue(new Error("offline"));
    await expect(getNflverseSeason(2025)).resolves.toEqual(EMPTY_NFLVERSE);
  });
});
