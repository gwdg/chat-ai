import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ToolsButton from "../ToolsButton";

const brand = vi.hoisted(() => ({ locked: false }));
const modules = vi.hoisted(() => ({ tools: true }));
const agents = vi.hoisted(() => ({ enabled: false }));

vi.mock("../../../config/brandPolicy", () => ({
  isBrandLocked: (key) => key === "tools" && brand.locked,
}));
vi.mock("../../../utils/modules", () => ({
  isToolsEnabled: () => modules.tools,
}));
vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => agents.enabled,
}));
vi.mock("../../SettingsPanel/ToolsContainer", () => ({
  default: () => <div data-testid="tools-content" />,
}));

const localState = { settings: { tools: {} } };
const renderButton = () =>
  render(<ToolsButton localState={localState} setLocalState={vi.fn()} />);

describe("ToolsButton", () => {
  beforeEach(() => {
    brand.locked = false;
    modules.tools = true;
    agents.enabled = false;
  });

  it("renders the tools entry point when the module is on", () => {
    const { container } = renderButton();
    expect(container.querySelector('[data-guide="tools"]')).toBeInTheDocument();
  });

  it("is removed when the brand fixes GWDG Tools", () => {
    brand.locked = true;
    const { container } = renderButton();
    expect(container).toBeEmptyDOMElement();
  });
});
