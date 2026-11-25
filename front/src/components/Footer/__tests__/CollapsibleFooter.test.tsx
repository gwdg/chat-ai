import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

import i18n from "../../../i18n";
import { getBrandProfile } from "../../../config/brands";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";

const currentBrand = { current: getBrandProfile("chat-ai") };
const openModal = vi.fn();

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: currentBrand.current }),
}));

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal }),
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

  it("opens an app route in place and an external link in a new tab", async () => {
    await i18n.changeLanguage("en");
    currentBrand.current = {
      ...getBrandProfile("chat-ai"),
      footer: {
        isoCertified: true,
        links: {
          about: { url: "/about" },
          privacy: {},
        },
      },
    };
    renderFooter();

    const about = linkFor("About");
    expect(about).toHaveAttribute("href", "/about");
    expect(about).not.toHaveAttribute("target");
    expect(linkFor("Data Privacy (ChatAI)")).toHaveAttribute("target", "_blank");
  });

  it("offers the bug report only when a feedback receiver is configured", async () => {
    await i18n.changeLanguage("en");
    currentBrand.current = getBrandProfile("chat-ai");

    const { unmount } = renderFooter();
    expect(
      screen.queryByRole("button", { name: "Report a problem" }),
    ).not.toBeInTheDocument();
    unmount();

    vi.stubEnv("VITE_FEEDBACK_ENDPOINT", "/feedback");
    openModal.mockClear();
    renderFooter();
    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    expect(openModal).toHaveBeenCalledWith("bugReport");
    vi.unstubAllEnvs();
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

  it("opens the footer dropdowns upward so their menus stay on screen", () => {
    // The footer is the last grid row. daisyUI's default menu anchor is below
    // the trigger, which put the theme and language menus past the viewport
    // bottom and made both controls look broken (GAIA's extra themes turn the
    // theme switch into a menu as well).
    currentBrand.current = getBrandProfile("gaia");
    const { container } = renderFooter();

    expect(container.querySelector('[data-guide="theme-toggle"]')).toHaveClass(
      "dropdown-top",
    );
    expect(
      container.querySelector('[data-guide="language-picker"]'),
    ).toHaveClass("dropdown-top");
  });
});
