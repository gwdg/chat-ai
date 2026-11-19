import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

import i18n from "../../../i18n";
import { getBrandProfile } from "../../../config/brands";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";

const currentBrand = { current: getBrandProfile("chat-ai") };

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: currentBrand.current }),
}));

import CollapsibleFooter from "../CollapsibleFooter";

const store = configureStore({
  reducer: { interface_settings: interfaceSettingsReducer },
});

const renderFooter = () =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <CollapsibleFooter />
      </MemoryRouter>
    </Provider>,
  );

const linkFor = (label) => screen.getByText(label).closest("a");

describe("CollapsibleFooter", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders the Chat AI footer with the renamed privacy link", () => {
    currentBrand.current = getBrandProfile("chat-ai");
    renderFooter();

    expect(linkFor("Data Privacy (ChatAI)")).toHaveAttribute(
      "href",
      "https://docs.hpc.gwdg.de/services/chat-ai/data-privacy.de/index.html",
    );
    expect(linkFor("Imprint")).toHaveAttribute("href", "https://gwdg.de/imprint/");
    expect(screen.getByText("ISO 27001 Certified")).toBeInTheDocument();
  });

  it("uses a brand's own link and drops the GWDG ISO claim", () => {
    currentBrand.current = getBrandProfile("ugoe");
    renderFooter();

    expect(linkFor("Data Privacy for UGOE")).toHaveAttribute(
      "href",
      "https://uni-goettingen.de/de/439479.html",
    );
    // Links the brand does not override keep the Chat AI targets.
    expect(linkFor("Imprint")).toHaveAttribute("href", "https://gwdg.de/imprint/");
    expect(screen.queryByText("ISO 27001 Certified")).not.toBeInTheDocument();
  });

  it("localises a brand label that carries both languages", async () => {
    currentBrand.current = getBrandProfile("ugoe");
    await i18n.changeLanguage("de");
    renderFooter();

    expect(screen.getByText("Datenschutz für UGOE")).toBeInTheDocument();
    expect(linkFor("Impressum")).toHaveAttribute("href", "https://gwdg.de/imprint/");
  });

  it("hides a disabled link and supports an extra one", async () => {
    await i18n.changeLanguage("en");
    currentBrand.current = {
      ...getBrandProfile("chat-ai"),
      footer: {
        isoCertified: true,
        links: {
          imprint: { visible: false },
          privacy: {},
          support: { label: "Support", url: "mailto:support@example.org" },
        },
      },
    };
    renderFooter();

    expect(screen.queryByText("Imprint")).not.toBeInTheDocument();
    expect(screen.getByText("Data Privacy (ChatAI)")).toBeInTheDocument();
    expect(linkFor("Support")).toHaveAttribute(
      "href",
      "mailto:support@example.org",
    );
  });
});
