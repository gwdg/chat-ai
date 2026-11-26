import { describe, expect, it } from "vitest";
import { showAdvancedSidebarSections } from "../sidebarVisibility";

describe("showAdvancedSidebarSections", () => {
  it("hides every advanced section while advanced mode is off", () => {
    expect(showAdvancedSidebarSections(false, true, true)).toEqual({
      agents: false,
      mcpServers: false,
      arcanas: false,
    });
  });

  it("shows every advanced section when advanced mode is on", () => {
    expect(showAdvancedSidebarSections(true, true, true)).toEqual({
      agents: true,
      mcpServers: true,
      arcanas: true,
    });
  });

  it("still respects a disabled Agents module", () => {
    expect(showAdvancedSidebarSections(true, false, true)).toEqual({
      agents: false,
      mcpServers: true,
      arcanas: true,
    });
  });

  it("still respects a disabled Arcanas module", () => {
    expect(showAdvancedSidebarSections(true, true, false)).toEqual({
      agents: true,
      mcpServers: true,
      arcanas: false,
    });
  });

  it("keeps MCP servers independent of both module flags", () => {
    expect(showAdvancedSidebarSections(true, false, false)).toEqual({
      agents: false,
      mcpServers: true,
      arcanas: false,
    });
  });
});
