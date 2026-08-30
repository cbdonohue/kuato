import { describe, expect, it } from "vitest";
import {
  buildInjuryTable,
  formatTypicalMissed,
  lookupTypical,
  normalizeInjuryPart,
  parseInjuryWeeks,
  tableFromCsvs,
} from "./injuries";

const hamstringCsv = `season,season_type,week,gsis_id,report_primary_injury,report_status
2024,REG,1,00-0001,Hamstring,Out
2024,REG,2,00-0001,Hamstring,Out
2024,REG,3,00-0002,Hamstring,Out
2024,REG,4,00-0002,Hamstring,Out
2024,REG,5,00-0002,Hamstring,Out
2024,REG,6,00-0002,Hamstring,Out
`;

describe("normalizeInjuryPart", () => {
  it("maps Sleeper and nflverse synonyms", () => {
    expect(normalizeInjuryPart("hamstring")).toBe("hamstring");
    expect(normalizeInjuryPart("Right Knee")).toBe("knee");
    expect(normalizeInjuryPart("quadriceps")).toBe("quad");
    expect(normalizeInjuryPart("illness")).toBeNull();
    expect(normalizeInjuryPart("mystery ailment")).toBeNull();
  });
});

describe("buildInjuryTable", () => {
  it("takes the median of hamstring Out streaks", () => {
    const table = tableFromCsvs([hamstringCsv], 1);
    expect(table.hamstring?.median).toBe(3);
    expect(table.hamstring?.n).toBe(2);
  });

  it("returns null for an unknown part", () => {
    const table = tableFromCsvs([hamstringCsv], 1);
    expect(lookupTypical(table, "mystery ailment")).toBeNull();
    expect(lookupTypical(table, "illness")).toBeNull();
  });

  it("does not start a missed-game spell from Questionable-only weeks", () => {
    const csv = `season,season_type,week,gsis_id,report_primary_injury,report_status
2024,REG,1,00-0003,Hamstring,Questionable
2024,REG,2,00-0003,Hamstring,Questionable
`;
    const weeks = parseInjuryWeeks(csv);
    expect(weeks).toHaveLength(2);
    expect(weeks.every((week) => !week.missed)).toBe(true);
    expect(buildInjuryTable(weeks, 1).hamstring).toBeUndefined();
  });
});

describe("formatTypicalMissed", () => {
  it("uses a range when p25 and p75 differ", () => {
    expect(
      formatTypicalMissed({
        part: "hamstring",
        label: "Hamstring",
        median: 3,
        p25: 2,
        p75: 4,
        n: 40,
      }),
    ).toBe("typically 2–4 games historically");
  });

  it("uses a single count when the quartiles match", () => {
    expect(
      formatTypicalMissed({
        part: "knee",
        label: "Knee",
        median: 2,
        p25: 2,
        p75: 2,
        n: 40,
      }),
    ).toBe("typically 2 games historically");
  });
});
