import { render, screen } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import packageJson from "../../../../package.json";
import i18n from "../../../i18n";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";
import { getBrandProfile, localizeBrandValue } from "../../../config/brands";

const brandState = vi.hoisted(() => ({ brand: null }));

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: brandState.brand, brandId: brandState.brand?.id }),
}));

import WelcomeModal from "../WelcomeModal";

const renderModal = () => {
  const store = configureStore({
    reducer: { interface_settings: interfaceSettingsReducer },
  });
  return render(
    <Provider store={store}>
      <WelcomeModal isOpen onClose={() => {}} onRunTour={() => {}} />
    </Provider>,
  );
};

describe("WelcomeModal", () => {
  it("greets the visitor with the active brand", () => {
    brandState.brand = getBrandProfile("gaia");
    renderModal();
    expect(
      screen.getByText(new RegExp(`Welcome to GAIA ${packageJson.version}`)),
    ).toBeInTheDocument();
  });

  it("keeps the Chat AI greeting for the default brand", () => {
    brandState.brand = getBrandProfile("chat-ai");
    renderModal();
    expect(
      screen.getByText(new RegExp(`Welcome to Chat AI ${packageJson.version}`)),
    ).toBeInTheDocument();
  });

  it("localizes a brand name that is an object", () => {
    brandState.brand = getBrandProfile("mpg");
    renderModal();
    const name = localizeBrandValue(
      getBrandProfile("mpg").name,
      i18n.language,
    );
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(
      screen.getByText(new RegExp(`Welcome to ${escaped} ${packageJson.version}`)),
    ).toBeInTheDocument();
  });
});
