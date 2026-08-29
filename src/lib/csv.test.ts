import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

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
});
