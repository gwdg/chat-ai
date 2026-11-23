import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { getBrandProfile } from "../../config/brands";

// The markdown in an information page renders through the chat renderer, which
// reads the HTML preferences from Redux.
vi.mock("react-redux", () => ({
  useSelector: (selector) => selector({ user_settings: {}, interface_settings: {} }),
}));

const currentBrand = { current: getBrandProfile("chat-ai") };

vi.mock("../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: currentBrand.current }),
}));

import BrandPage from "../BrandPage";
import SitemapPage from "../SitemapPage";

const renderIn = (element) =>
  render(<MemoryRouter>{element}</MemoryRouter>);

describe("brand information pages", () => {
  it("renders the brand's own markdown for a page", () => {
    currentBrand.current = {
      ...getBrandProfile("chat-ai"),
      pages: { about: "# About this service\n\nIt is a chat client." },
    };
    renderIn(<BrandPage page="about" titleKey="about.title" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "About" }),
    ).toBeInTheDocument();
    // The brand copy is the body, rendered as markdown.
    expect(screen.getByText("It is a chat client.")).toBeInTheDocument();
  });

  it("points at the brand's external page when there is no copy", () => {
    currentBrand.current = {
      ...getBrandProfile("chat-ai"),
      links: { about: "https://example.org/about" },
    };
    renderIn(<BrandPage page="about" titleKey="about.title" />);

    expect(screen.getByRole("link", { name: "Open the page" })).toHaveAttribute(
      "href",
      "https://example.org/about",
    );
  });

  it("lists the app's own pages in the sitemap", () => {
    currentBrand.current = getBrandProfile("chat-ai");
    renderIn(<SitemapPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sitemap" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByRole("link", { name: "Accessibility" })).toHaveAttribute(
      "href",
      "/accessibility",
    );
    expect(screen.getByRole("link", { name: "New Chat" })).toHaveAttribute(
      "href",
      "/chat",
    );
  });
});
