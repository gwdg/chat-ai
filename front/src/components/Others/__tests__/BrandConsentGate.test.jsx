import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BrandConsentGate from "../BrandConsentGate";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";
import { getBrandProfile } from "../../../config/brands";

const brandState = vi.hoisted(() => ({ brand: null }));

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({
    brand: brandState.brand,
    brandId: brandState.brand?.id ?? "chat-ai",
  }),
}));

const gaia = () => getBrandProfile("gaia");

const setup = (preloaded = {}) => {
  const store = configureStore({
    reducer: { interface_settings: interfaceSettingsReducer },
    preloadedState: { interface_settings: preloaded },
  });
  const view = render(
    <Provider store={store}>
      <BrandConsentGate />
    </Provider>,
  );
  return { store, view };
};

beforeEach(() => {
  brandState.brand = gaia();
});

describe("BrandConsentGate", () => {
  it("renders nothing for a brand without a consent gate", () => {
    brandState.brand = getBrandProfile("chat-ai");
    setup();
    expect(screen.queryByText("Welcome to GAIA")).not.toBeInTheDocument();
  });

  it("requires the terms checkbox before continuing", async () => {
    setup();

    expect(await screen.findByText("Welcome to GAIA")).toBeInTheDocument();
    // The summary is sanitized HTML with its own structure.
    expect(screen.getByText("Terms of use")).toBeInTheDocument();
    expect(
      screen.getByText(/GAIA is for you\. GAIA helps you learn\./),
    ).toBeInTheDocument();
    // External legal links only, opened in a new tab.
    const link = screen.getByRole("link", { name: "Data protection" });
    expect(link).toHaveAttribute("href", "https://gaia.uni-goettingen.de/legal/data-protection");
    expect(link).toHaveAttribute("target", "_blank");

    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    expect(screen.getByText(/please accept the terms/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(next).toBeEnabled();
  });

  it("asks each purpose off by default and stores the acceptance", async () => {
    const { store } = setup();
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Your consents")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(4);
    expect(switches.every((input) => !input.checked)).toBe(true);
    expect(
      screen.getByRole("switch", { name: "Surveys about GAIA" }),
    ).not.toBeChecked();

    // One opt-in is chosen; the rest stay declined.
    fireEvent.click(screen.getByRole("switch", { name: "Surveys about GAIA" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    const record = store.getState().interface_settings.consent_acceptance.gaia;
    expect(record.version).toBe("2026-02");
    expect(record.answers).toEqual({
      surveys: true,
      advanced_logging: false,
      survey_linking: false,
      data_linking: false,
    });
    expect(record.acceptedAt).toMatch(/^\d{4}-/);
    // The gate closes once the record matches.
    expect(screen.queryByText("Your consents")).not.toBeInTheDocument();
  });

  it("stays closed for a matching acceptance and reopens after a version bump", () => {
    const accepted = {
      gaia: {
        version: "2026-02",
        answers: {},
        acceptedAt: "2026-02-01T10:00:00.000Z",
      },
    };
    const { view } = setup({ consent_acceptance: accepted });
    expect(screen.queryByText("Welcome to GAIA")).not.toBeInTheDocument();
    view.unmount();

    setup({
      consent_acceptance: {
        gaia: { ...accepted.gaia, version: "2025-01" },
      },
    });
    expect(screen.getByText("Welcome to GAIA")).toBeInTheDocument();
  });
});
