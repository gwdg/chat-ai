import { describe, expect, it } from "vitest";
import {
  getDefaultChatAIModel,
  getDefaultConversation,
  getDefaultSettings,
} from "../conversationUtils";

describe("conversation defaults", () => {
  it("merges user settings over defaults", () => {
    const settings = getDefaultSettings({
      temperature: 1.2,
      tools: { codemode: false },
    });
    expect(settings.temperature).toBe(1.2);
    expect(settings.tools.codemode).toBe(false);
    expect(settings.tools.mcp).toBeUndefined();
  });

  it("defaults both MCP switches off", () => {
    const settings = getDefaultSettings();
    expect(settings.tools.mcp).toBe(false);
    expect(settings.tools.mcp_remote).toBe(false);
  });

  it("keeps browser storage off by default", () => {
    expect(getDefaultSettings().tools.browser_storage).toBe(false);
  });

  it("keeps ArcanaV2 off by default", () => {
    expect(getDefaultSettings().tools.arcana_v2).toBe(false);
  });

  it("maps the old remote file access switch to ArcanaV2", () => {
    expect(
      getDefaultSettings({ tools: { remote_file_access: true } }).tools.arcana_v2,
    ).toBe(true);
  });

  it("builds a default conversation with a timestamp and message", () => {
    const conversation = getDefaultConversation(
      { model: { id: "test-model", name: "Test" } },
      "folder-1",
    );
    expect(conversation.id).toBeTruthy();
    expect(conversation.folderId).toBe("folder-1");
    expect(conversation.messages[0].role).toBe("system");
    expect(conversation.settings.model.id).toBe("test-model");
  });

  it("resolves the default chat model", () => {
    expect(getDefaultChatAIModel({ model: { id: "test-model" } })).toBe("test-model");
  });
});
