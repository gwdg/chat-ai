import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsContent from "../SettingsContent";
import ToolsContainer from "../ToolsContainer";

// Advanced mode is switched on here on purpose: the profile owns that setting now,
// so the prompt panel must not render a second switch for it either way.
const state = vi.hoisted(() => ({
  user_settings: {
    advanced_mode: true,
    memories: [],
    memory_groups: [],
    default_memory_group: "default",
    memory_mode: 0,
  },
  interface_settings: { agree_web_search: true },
}));

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector) => selector(state),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => false,
  agentGatewayTools: () => true,
  modelSupportsTools: () => true,
}));
vi.mock("../../../db", async (importOriginal) => ({
  ...(await importOriginal()),
  useConversationList: () => [],
}));

const localState = {
  messages: [
    {
      role: "system",
      content: [{ type: "text", text: "You are a helpful assistant" }],
    },
  ],
  settings: {
    model: { id: "test-model", name: "Test Model" },
    enable_tools: true,
    tools: {},
    system_prompt: "You are a helpful assistant",
  },
};

const renderPanel = () => {
  const setLocalState = vi.fn((updater) => updater(localState));
  render(
    <>
      <SettingsContent
        localState={localState}
        setLocalState={setLocalState}
        userData={{}}
        modelsData={[]}
      />
      <ToolsContainer localState={localState} setLocalState={setLocalState} />
    </>,
  );
  return setLocalState;
};

describe("SettingsContent", () => {
  it("does not repeat the advanced mode switch owned by the profile", () => {
    renderPanel();

    expect(
      document.querySelector('[data-guide="conversation-settings-panel"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="advanced-mode-preference"]'),
    ).not.toBeInTheDocument();
  });

  it("keeps the prompt tools section next to the settings panel", () => {
    renderPanel();

    expect(document.querySelector('[data-guide="tools-enable"]')).toBeInTheDocument();
    expect(document.querySelector('[data-guide="tools-grid"]')).toBeInTheDocument();
  });
});
