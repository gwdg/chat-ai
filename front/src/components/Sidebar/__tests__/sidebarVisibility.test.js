import { describe, expect, it } from "vitest";
import { showAdvancedSidebarSections } from "../sidebarVisibility";

describe("showAdvancedSidebarSections", () => {
  it("hides both advanced sections while advanced mode is off", () => {
    expect(showAdvancedSidebarSections(false, true)).toEqual({
      agents: false,
      mcpServers: false,
    });
  });

  it("shows both advanced sections when advanced mode is on", () => {
    expect(showAdvancedSidebarSections(true, true)).toEqual({
      agents: true,
      mcpServers: true,
    });
  });

  it("still respects a disabled Agents module", () => {
    expect(showAdvancedSidebarSections(true, false)).toEqual({
      agents: false,
      mcpServers: true,
    });
  });
});
