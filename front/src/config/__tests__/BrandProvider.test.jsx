import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../apis/getUserData", () => ({
  getUserDataCached: vi.fn(async () => ({ brand: "UGOE" })),
}));

import { BrandProvider, useBrand } from "../BrandProvider";
import BrandLogo from "../../components/Others/BrandLogo";

function Probe() {
  const { brand, brandId } = useBrand();
  return <span data-testid="probe">{`${brandId}:${brand.name}`}</span>;
}

describe("BrandProvider", () => {
  it("resolves the brand from the user profile and applies the document", async () => {
    render(
      <BrandProvider>
        <Probe />
        <BrandLogo />
      </BrandProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("ugoe:Chat AI"),
    );
    await waitFor(() =>
      expect(document.documentElement.dataset.brand).toBe("ugoe"),
    );
    expect(document.getElementById("brand-theme")?.textContent).toContain(
      "--color-primary: #13306a;",
    );

    // A brand with a dark asset renders both and lets CSS choose.
    const logos = await screen.findAllByRole("img");
    const sources = logos.map((img) => img.getAttribute("src"));
    expect(sources.some((src) => src?.includes("branding/ugoe/logo.svg"))).toBe(
      true,
    );
    expect(
      sources.some((src) => src?.includes("branding/ugoe/logo-dark.svg")),
    ).toBe(true);
  });

  it("keeps the default brand when the profile is unknown", async () => {
    const { getUserDataCached } = await import("../../apis/getUserData");
    getUserDataCached.mockResolvedValueOnce({ brand: "not-a-brand" });

    render(
      <BrandProvider>
        <Probe />
      </BrandProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("chat-ai:Chat AI"),
    );
    expect(document.getElementById("brand-theme")?.textContent).toBe("");
  });
});
