import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

import i18n from "../../i18n";
import { getBrandProfile } from "../../config/brands";
import interfaceSettingsReducer from "../../Redux/reducers/interfaceSettingsSlice";

const currentBrand = { current: getBrandProfile("chat-ai") };

vi.mock("../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: currentBrand.current }),
}));

import BrandHeader from "../Header/BrandHeader";
import BrandDisclaimer from "../Conversation/BrandDisclaimer";
import CollapsibleFooter from "../Footer/CollapsibleFooter";

const store = configureStore({
  reducer: { interface_settings: interfaceSettingsReducer },
});

describe("brand surfaces", () => {
  beforeEach(async () => {
    currentBrand.current = getBrandProfile("chat-ai");
    await i18n.changeLanguage("en");
  });

  it("renders the MPG header and nothing for Chat AI", () => {
    currentBrand.current = getBrandProfile("mpg");
    const { container } = render(<BrandHeader />);

    expect(
      screen.getByText("AI Assistant for the Organisational Handbook"),
    ).toBeInTheDocument();
    expect(screen.getByText("Instructions and Working Aids")).toBeInTheDocument();
    expect(screen.getByAltText("Max-Planck-Gesellschaft")).toHaveAttribute(
      "src",
      expect.stringContaining("branding/mpg/logo.svg"),
    );
    expect(container.firstChild).toHaveStyle({
      color: "#006c66",
      backgroundColor: "#ffffff",
    });
  });

  it("renders no header for Chat AI", () => {
    const { container } = render(<BrandHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("strips scripts and handlers from the disclaimer", () => {
    currentBrand.current = {
      ...getBrandProfile("mpg"),
      disclaimer:
        '<h2>Heading</h2><script>window.__bad = 1</script><p onclick="bad()">Body <a href="https://example.org" target="_blank">Link</a></p>',
    };
    const { container } = render(<BrandDisclaimer />);

    expect(container).toHaveTextContent("Heading");
    expect(container).toHaveTextContent("Body");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector("a")).toHaveAttribute("target", "_blank");
  });

  it("renders no disclaimer for Chat AI", () => {
    const { container } = render(<BrandDisclaimer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the brand's help link next to Imprint", () => {
    currentBrand.current = getBrandProfile("mpg");
    render(
      <Provider store={store}>
        <MemoryRouter>
          <CollapsibleFooter />
        </MemoryRouter>
      </Provider>,
    );

    const help = screen.getByRole("link", { name: "Help" });
    expect(help).toHaveAttribute("target", "_blank");
    expect(help).toHaveAttribute(
      "href",
      expect.stringContaining("OHB-Chatbot__DE___EN__v1.0.pdf"),
    );
  });

  it("shows no help link for Chat AI", () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <CollapsibleFooter />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.queryByRole("link", { name: "Help" })).toBeNull();
  });
});
