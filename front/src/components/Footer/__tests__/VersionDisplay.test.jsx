import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import packageJson from "../../../../package.json";
import i18n from "../../../i18n";
import { getBrandProfile, localizeBrandValue } from "../../../config/brands";

const brandState = vi.hoisted(() => ({ brand: null }));

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: brandState.brand, brandId: brandState.brand?.id }),
}));

import VersionDisplay from "../VersionDisplay";

describe("VersionDisplay", () => {
  it("names the active brand and links to its home page", () => {
    brandState.brand = getBrandProfile("gaia");
    render(<VersionDisplay />);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent(`GAIA v${packageJson.version}`);
    expect(link).toHaveAttribute("href", "https://gaia.uni-goettingen.de/");
    // Still a build product of this repository, so the source stays reachable.
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("keeps the Chat AI name for the default brand", () => {
    brandState.brand = getBrandProfile("chat-ai");
    render(<VersionDisplay />);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent(`Chat AI v${packageJson.version}`);
    expect(link).toHaveAttribute("href", "https://chat-ai.academiccloud.de/");
  });

  it("localizes a brand name that is an object", () => {
    brandState.brand = getBrandProfile("mpg");
    render(<VersionDisplay />);

    const expected = localizeBrandValue(
      getBrandProfile("mpg").name,
      i18n.language,
    );
    expect(screen.getByRole("link")).toHaveTextContent(
      `${expected} v${packageJson.version}`,
    );
  });

  it("falls back to the package name and repository without a brand", () => {
    brandState.brand = null;
    render(<VersionDisplay />);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent(`${packageJson.displayName} v${packageJson.version}`);
    expect(link).toHaveAttribute("href", "https://github.com/gwdg/chat-ai");
  });
});
