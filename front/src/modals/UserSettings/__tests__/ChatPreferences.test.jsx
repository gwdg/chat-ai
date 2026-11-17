import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";

import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";
import UserSettingsModal from "../UserSettingsModal";

vi.mock("../../ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
// The model list is unrelated to the preferences under test.
vi.mock("../DefaultModelSelector", () => ({
  default: () => <div data-testid="default-model-selector" />,
}));

const makeStore = () =>
  configureStore({ reducer: { user_settings: userSettingsReducer } });

const renderChatTab = () => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <UserSettingsModal
        isOpen
        onClose={() => {}}
        userData={{ username: "user" }}
        modelsData={[]}
        localState={{ settings: {} }}
        initialTab="chat"
      />
    </Provider>,
  );
  return store;
};

describe("Chat preferences", () => {
  it("renders Advanced mode and toggles the shared advanced_mode setting", () => {
    const store = renderChatTab();
    const advancedSwitch = screen.getByRole("switch", {
      name: "Advanced mode",
    });

    expect(screen.getByTestId("default-model-selector")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Show Agents and MCP servers in the sidebar. When this is off, the sidebar shows only chats and workspaces.",
      ),
    ).toBeInTheDocument();
    expect(store.getState().user_settings.advanced_mode).toBe(false);

    fireEvent.click(advancedSwitch);

    expect(store.getState().user_settings.advanced_mode).toBe(true);
    expect(advancedSwitch).toHaveAttribute("aria-checked", "true");
  });
});
