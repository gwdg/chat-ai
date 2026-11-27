import { describe, expect, it } from "vitest";
import { getBrandProfile, setCurrentBrand } from "../../config/brands";
import {
  getDefaultChatAIModel,
  getDefaultConversation,
  getDefaultSettings,
  getDefaultSystemPrompt,
  storedModelNeedsRefresh,
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

  it("defaults the MCP switch off", () => {
    const settings = getDefaultSettings();
    expect(settings.tools.mcp).toBe(false);
    expect("mcp_remote" in settings.tools).toBe(false);
  });

  it("enables access storage by default", () => {
    expect(getDefaultSettings().tools.browser_storage).toBe(true);
  });

  it("keeps Arcana Tools off by default", () => {
    expect(getDefaultSettings().tools.arcana_tools).toBe(false);
  });

  it("maps the old remote file access switch to Arcana Tools", () => {
    expect(
      getDefaultSettings({ tools: { remote_file_access: true } }).tools.arcana_tools,
    ).toBe(true);
  });

  it("maps the old arcana_v2 switch to Arcana Tools", () => {
    const settings = getDefaultSettings({ tools: { arcana_v2: true } });
    expect(settings.tools.arcana_tools).toBe(true);
    expect(settings.tools.arcana_v2).toBeUndefined();
    expect(settings.tools.remote_file_access).toBeUndefined();
  });

  it("prefers the new Arcana Tools switch over a legacy one", () => {
    expect(
      getDefaultSettings({ tools: { arcana_tools: false, arcana_v2: true } }).tools
        .arcana_tools,
    ).toBe(false);
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

  it("keeps the Chat AI system prompt when the brand has none", () => {
    expect(getDefaultSystemPrompt()).toBe("You are a helpful assistant.");
  });

  it("fixes the model and the tools for a brand that locks them", () => {
    setCurrentBrand(getBrandProfile("gaia"));
    try {
      const settings = getDefaultSettings({
        enable_tools: true,
        model: { id: "qwen3-30b-a3b-instruct-2507", name: "Qwen" },
        tools: { web_search: true, image_generation: false },
      });
      expect(settings.model.id).toBe("deepseek-v4.1-flash-1017");
      // The deployment's defaults replace a stored choice, not the user's.
      expect(settings.enable_tools).toBe(false);
      expect(settings.tools.web_search).toBe(false);
      expect(settings.tools.image_generation).toBe(true);
    } finally {
      setCurrentBrand(null);
    }
  });

  it("uses the active brand's system prompt for a new conversation", () => {
    setCurrentBrand(getBrandProfile("mpg"));
    try {
      expect(getDefaultSystemPrompt()).toContain("Max Planck Society");
      const conversation = getDefaultConversation();
      expect(conversation.messages[0].content[0].text).toContain(
        "ROLE & OBJECTIVE",
      );
    } finally {
      setCurrentBrand(null);
    }
  });
});

describe("storedModelNeedsRefresh", () => {
  // A conversation stores the model row it was sent with; `/models` can correct
  // that row for the same id (an in-house bridge model that was labelled
  // external), and the selector writes the fresh one back.
  const stored = {
    id: "bridge/deepseek-v4.1-flash-1017",
    name: "DeepSeek V4.1 Flash 1017 (External)",
    status: "ready",
    input: ["text"],
    output: ["text"],
    external: true,
  };

  it("refreshes a model whose label the deployment corrected", () => {
    expect(
      storedModelNeedsRefresh(
        {
          ...stored,
          name: "DeepSeek V4.1 Flash 1017",
          external: false,
        },
        stored,
      ),
    ).toBe(true);
  });

  it("refreshes on `external` alone, because it decides the data-safety warning", () => {
    expect(storedModelNeedsRefresh({ ...stored, external: false }, stored)).toBe(true);
  });

  it("refreshes a stored `external` the deployment does not send any more", () => {
    // A deployment without the field expresses externality in the name only, so
    // the stored `true` must be replaced by the row (which carries no field).
    const fresh = {
      id: stored.id,
      name: "DeepSeek V4.1 Flash 1017",
      status: "ready",
      input: ["text"],
      output: ["text"],
    };
    expect(storedModelNeedsRefresh(fresh, stored)).toBe(true);
  });

  it("keeps identical data, so the 30 s refresh does not autosave", () => {
    expect(storedModelNeedsRefresh({ ...stored }, { ...stored })).toBe(false);
  });

  it("keeps the chat's model when the deployment does not list it", () => {
    expect(storedModelNeedsRefresh(undefined, stored)).toBe(false);
  });

  it("fills in capabilities a chat saved before the field existed", () => {
    expect(
      storedModelNeedsRefresh(
        { id: "qwen3.8-27b", name: "Qwen", status: "ready", input: ["text"] },
        { id: "qwen3.8-27b", name: "Qwen" },
      ),
    ).toBe(true);
  });

  it("treats a missing stored object as needing a refresh", () => {
    expect(storedModelNeedsRefresh(stored, undefined)).toBe(true);
  });
});
