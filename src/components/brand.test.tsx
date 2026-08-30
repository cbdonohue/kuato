import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLink, BrandMark } from "./brand";

describe("Brand", () => {
  it("renders the logo mark", () => {
    const { container } = render(<BrandMark size={48} className="hero-logo" />);
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/kuato.png");
    expect(image).toHaveAttribute("width", "48");
    expect(image).toHaveClass("hero-logo");
  });

  it("links the wordmark home", () => {
    const { container } = render(<BrandLink />);
    const link = screen.getByRole("link", { name: "Kuato" });
    expect(link).toHaveAttribute("href", "/");
    expect(container.querySelector("img")).toHaveAttribute("src", "/kuato.png");
  });
});
