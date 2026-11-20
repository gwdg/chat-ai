import { fireEvent, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";

import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";
import UserSettingsModal from "../UserSettingsModal";

vi.mock("../../ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
// Suggestions only render when the choices module is on and the MCP policy only
// when the tools module is on; this test checks the layout, so force both on and
// keep every other module accessor as it is.
vi.mock("../../../utils/modules", async (importOriginal) => ({
  ...(await importOriginal()),
  isChoicesEnabled: () => true,
  isToolsEnabled: () => true,
}));
// The model list is unrelated to the preferences under test.
vi.mock("../DefaultModelSelector", () => ({
  default: () => <div data-testid="default-model-selector" />,
}));

const makeStore = () =>
  configureStore({
    reducer: {
      user_settings: userSettingsReducer,
      interface_settings: interfaceSettingsReducer,
    },
  });

const renderTab = (initialTab, userData = { username: "user" }) => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <UserSettingsModal
        isOpen
        onClose={() => {}}
        userData={userData}
        modelsData={[]}
        localState={{ settings: {} }}
        initialTab={initialTab}
      />
    </Provider>,
  );
  return store;
};

describe("User settings tabs", () => {
  it("keeps the chat tab to chat preferences, without advanced mode or rendering", () => {
    renderTab("chat");

    expect(screen.getByTestId("default-model-selector")).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Advanced mode" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Render Typst blocks" }),
    ).not.toBeInTheDocument();
  });

  it("flattens the chat tab: no section headers, separators or help button", () => {
    const store = renderTab("chat");
    const panel = screen.getByRole("region", { name: "Chat preferences" });

    for (const name of ["Suggestions", "Conversation summaries", "Messages"]) {
      expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
    }
    expect(panel.querySelectorAll(".border-t")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Learn about follow-up prompts" }),
    ).not.toBeInTheDocument();

    const suggestions = screen.getByRole("switch", {
      name: "Suggest follow-up prompts",
    });
    const summaries = screen.getByRole("switch", {
      name: "Show summaries on hover",
    });
    const timestamps = screen.getByRole("switch", {
      name: "Show message timestamps",
    });
    expect(summaries).toBeInTheDocument();
    expect(timestamps).toBeInTheDocument();

    expect(store.getState().user_settings.suggest_user_prompts).toBe(false);
    expect(store.getState().user_settings.conversation_summaries).toBe(true);
    expect(store.getState().user_settings.show_timestamps).toBe(false);

    fireEvent.click(suggestions);
    fireEvent.click(summaries);
    fireEvent.click(timestamps);

    expect(store.getState().user_settings.suggest_user_prompts).toBe(true);
    expect(store.getState().user_settings.conversation_summaries).toBe(false);
    expect(store.getState().user_settings.show_timestamps).toBe(true);
  });

  it("offers Usage and Advanced in the tab list", () => {
    renderTab("profile");

    expect(screen.getByRole("button", { name: "Usage" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Advanced" }),
    ).toBeInTheDocument();
  });

  it("renders Advanced mode and the rendering switches together in the advanced tab", () => {
    const store = renderTab("advanced");
    const advancedSwitch = screen.getByRole("switch", {
      name: "Advanced mode",
    });

    expect(
      screen.getByRole("switch", { name: "Render Typst blocks" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Render LaTeX blocks" }),
    ).toBeInTheDocument();
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

  it("offers the MCP tool policy in the advanced tab", () => {
    const store = renderTab("advanced");
    const group = screen.getByRole("group", {
      name: "MCP tool calls in chats",
    });

    expect(store.getState().user_settings.mcp_tool_policy).toBe("ask");

    fireEvent.click(within(group).getByRole("button", { name: "Always" }));
    expect(store.getState().user_settings.mcp_tool_policy).toBe("always");

    fireEvent.click(within(group).getByRole("button", { name: "Never" }));
    expect(store.getState().user_settings.mcp_tool_policy).toBe("never");

    expect(
      screen.getByText(
        "This setting only covers your MCP servers; Chat AI's own read, write and workspace tools are always available.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the usage tab with an honest empty state when the account has no limits", () => {
    renderTab("usage", { username: "user" });

    expect(
      screen.getByText("No usage limits are recorded for this account."),
    ).toBeInTheDocument();
  });

  it("shows the sidebar switch beside the limits in the usage tab", () => {
    renderTab("usage", {
      username: "user",
      limits: {
        user: { monthly_usage: 12, monthly_limit: 100 },
      },
    });

    expect(
      screen.getByRole("switch", { name: "Show usage in sidebar" }),
    ).toBeInTheDocument();
  });
});
