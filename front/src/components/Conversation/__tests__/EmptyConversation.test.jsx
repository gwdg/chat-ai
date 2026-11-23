import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getBrandProfile } from "../../../config/brands";

const brandState = vi.hoisted(() => ({ brand: null }));

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: brandState.brand, brandId: brandState.brand?.id }),
}));

import EmptyConversation from "../EmptyConversation";

describe("EmptyConversation", () => {
  it("uses the brand's own name for the logo alt text", () => {
    brandState.brand = getBrandProfile("gaia");
    const { container } = render(<EmptyConversation />);

    // A hard-coded "Chat AI Logo" alt would mislabel every branded deployment.
    const img = container.querySelector("img");
    expect(img).toHaveAttribute(
      "alt",
      "GAIA – Georg-August-Universität Göttingen",
    );
  });

  it("falls back to the brand name when it has no logo alt", () => {
    brandState.brand = getBrandProfile("restricted");
    const { container } = render(<EmptyConversation />);

    expect(container.querySelector("img")).toHaveAttribute(
      "alt",
      "Restricted Chat AI",
    );
  });
});
