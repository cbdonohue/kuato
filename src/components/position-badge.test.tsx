import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PositionBadge } from "./position-badge";

describe("PositionBadge", () => {
  it("shortens SUPER_FLEX to SF", () => {
    render(<PositionBadge position="SUPER_FLEX" />);
    expect(screen.getByText("SF")).toBeInTheDocument();
  });

  it("renders known and unknown positions", () => {
    const { rerender } = render(<PositionBadge position="QB" />);
    expect(screen.getByText("QB")).toBeInTheDocument();
    rerender(<PositionBadge position="BN" />);
    expect(screen.getByText("BN")).toBeInTheDocument();
  });
});
