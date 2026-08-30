import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRows } from "./csv";

describe("parseCsv", () => {
  it("keeps commas inside quoted fields", () => {
    const rows = parseCsv(
      `player_id,headshot_url,games\n00-1,"https://img.example/a,b,c",17\n`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].player_id).toBe("00-1");
    expect(rows[0].headshot_url).toBe("https://img.example/a,b,c");
    expect(rows[0].games).toBe("17");
  });

  it("unescapes doubled quotes and returns no records without a header row", () => {
    const rows = parseCsv(`name,note\n"Gibbs, Jr.","He said ""go""");
    expect(rows[0].name).toBe("Gibbs, Jr.");
    expect(rows[0].note).toBe('He said "go"');
    expect(parseCsv("only-header\n")).toEqual([]);
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseCsvRows", () => {
  it("skips blank lines and keeps a trailing field", () => {
    expect(parseCsvRows("a,b\n1,2\n\n3,4\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(parseCsvRows("a,b\n1,")).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });
});
