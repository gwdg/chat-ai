import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsButton from "../SettingsButton";

const brand = vi.hoisted(() => ({ locked: false }));

vi.mock("../../../config/brandPolicy", () => ({
  isBrandLocked: (key) => key === "chat_settings" && brand.locked,
}));
vi.mock("../../SettingsPanel/SettingsContent", () => ({
  default: () => <div data-testid="settings-content" />,
}));

const localState = {
  settings: { model: { id: "m", name: "M" }, tools: {} },
  messages: [],
};

const renderButton = () =>
  render(
    <SettingsButton
      localState={localState}
      setLocalState={vi.fn()}
      userData={{}}
      modelsData={[]}
    />,
  );

describe("SettingsButton", () => {
  beforeEach(() => {
    brand.locked = false;
  });

  it("renders the chat settings entry point by default", () => {
    const { container } = renderButton();
    expect(container.querySelector(".settings-toggle")).toBeInTheDocument();
  });

  it("is removed when the brand fixes the chat settings", () => {
    brand.locked = true;
    const { container } = renderButton();
    // Not just disabled: the panel would only show controls the institution
    // overrides, so the whole entry point is gone.
    expect(container.querySelector(".settings-toggle")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
