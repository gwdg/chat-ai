import { afterEach, describe, expect, it, vi } from "vitest";
import userSettingsReducer, {
  addMcpServer,
  addMemory,
  addMemoryGroup,
  deleteAllMemories,
  deleteMemory,
  deleteMemoryGroup,
  editMemory,
  getDefaultUserSettings,
  importUserSettings,
  removeMcpServer,
  renameMemoryGroup,
  setDefaultMemoryGroup,
  setMemoryGroup,
  setMemoryMode,
  updateMcpServer,
  setSendWithEnter,
  setRenderGraphviz,
  setRenderVega,
  setRenderChartjs,
  selectMemoryMode,
  selectGlobalMcpServers,
  selectMemoryGroups,
  selectDefaultMemoryGroup,
  selectRenderGraphviz,
  selectRenderVega,
  selectRenderChartjs,
  selectConversationSummaries,
  selectCollapseReasoningWhileStreaming,
  selectShowTimestamps,
  setCollapseReasoningWhileStreaming,
  setShowTimestamps,
  selectAdvancedMode,
  setAdvancedMode,
  selectMcpToolPolicy,
  setMcpToolPolicy,
  setFeedbackEnabled,
  selectFeedbackEnabled,
  setFeedbackSendTranscripts,
  selectFeedbackSendTranscripts,
  addE2eeKey,
  updateE2eeKey,
  removeE2eeKey,
  clearE2eeKeys,
  setE2eeModelKey,
  selectE2eeKeys,
  selectE2eeModels,
} from "../userSettingsReducer";
import interfaceSettingsReducer, {
  acceptBrandConsent,
  agreeWebSearch,
  collapseTopics,
  expandTopics,
  importInterfaceSettings,
  markTutorialCompleted,
  markUseCaseCompleted,
  setBrandTheme,
  setConversationGrouping,
  setWarning,
  suppressTutorial,
  toggleTheme,
  selectAgreeWebSearch,
  selectBrandConsent,
  selectBrandTheme,
  selectConversationGrouping,
  selectSuppressedTutorials,
} from "../interfaceSettingsSlice";

const init = (reducer) => reducer(undefined, { type: "@@INIT" });

describe("user settings reducer", () => {
  it("adds, edits, and deletes memories", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(state, addMemory({ text: "  one  " }));
    state = userSettingsReducer(state, addMemory({ text: "two" }));
    expect(state.memories.map((memory) => memory.text)).toEqual(["one", "two"]);

    state = userSettingsReducer(state, editMemory({ index: 0, text: "updated" }));
    expect(state.memories[0].text).toBe("updated");

    state = userSettingsReducer(state, deleteMemory({ index: 1 }));
    expect(state.memories).toHaveLength(1);
    state = userSettingsReducer(state, deleteAllMemories());
    expect(state.memories).toEqual([]);
  });

  it("groups memories and moves them to the default group on delete", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(
      state,
      addMemoryGroup({ id: "work", name: "Work" }),
    );
    state = userSettingsReducer(
      state,
      addMemoryGroup({ id: "work-2", name: "  work  " }),
    );
    expect(state.memory_groups).toEqual([{ id: "work", name: "Work" }]);

    state = userSettingsReducer(
      state,
      addMemory({ text: "a", groupId: "work" }),
    );
    state = userSettingsReducer(state, addMemory({ text: "b" }));
    state = userSettingsReducer(
      state,
      addMemory({ text: "c", groupId: "work" }),
    );
    expect(state.memories.map((memory) => memory.groupId)).toEqual([
      "work",
      "default",
      "work",
    ]);

    state = userSettingsReducer(
      state,
      editMemory({ index: 0, text: "a2", groupId: "work" }),
    );
    expect(state.memories[0].text).toBe("a2");
    expect(state.memories[2].text).toBe("c");

    state = userSettingsReducer(state, setDefaultMemoryGroup("work"));
    expect(state.default_memory_group).toBe("work");

    state = userSettingsReducer(
      state,
      setMemoryGroup({ index: 2, groupId: "default" }),
    );
    expect(state.memories[2].groupId).toBe("default");

    state = userSettingsReducer(state, renameMemoryGroup({ id: "work", name: "Job" }));
    expect(state.memory_groups).toEqual([{ id: "work", name: "Job" }]);

    state = userSettingsReducer(state, deleteMemoryGroup({ id: "work" }));
    expect(state.memory_groups).toEqual([]);
    expect(state.default_memory_group).toBe("default");
    expect(state.memories.map((memory) => memory.groupId)).toEqual([
      "default",
      "default",
      "default",
    ]);
    expect(selectMemoryGroups({ user_settings: state })).toEqual([]);
    expect(selectDefaultMemoryGroup({ user_settings: state })).toBe("default");
  });

  it("manages globally configured MCP servers", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(
      state,
      addMcpServer({
        id: "mcp-1",
        name: "Local files",
        url: "http://localhost:9000/mcp",
      }),
    );
    state = userSettingsReducer(
      state,
      addMcpServer({
        id: "mcp-2",
        name: "Notes",
        url: "http://localhost:9100/mcp",
      }),
    );
    expect(selectGlobalMcpServers({ user_settings: state })).toHaveLength(2);

    state = userSettingsReducer(
      state,
      updateMcpServer({ id: "mcp-1", patch: { name: "Files" } }),
    );
    expect(
      selectGlobalMcpServers({ user_settings: state }).find(
        (server) => server.id === "mcp-1",
      )?.name,
    ).toBe("Files");

    state = userSettingsReducer(state, removeMcpServer("mcp-2"));
    expect(selectGlobalMcpServers({ user_settings: state })).toHaveLength(1);
  });

  it("rejects an MCP server without a URL", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(
      state,
      addMcpServer({ id: "legacy", name: "Gateway", serverId: "server-1" }),
    );
    expect(selectGlobalMcpServers({ user_settings: state })).toEqual([]);
  });

  it("returns the same MCP server list for the same state", () => {
    // react-redux warns when a selector returns a new reference for an
    // unchanged state; the filtered list has to be memoized.
    let state = init(userSettingsReducer);
    state = userSettingsReducer(
      state,
      addMcpServer({ id: "mcp-1", name: "Files", url: "http://localhost:9000/mcp" }),
    );
    const first = selectGlobalMcpServers({ user_settings: state });
    expect(selectGlobalMcpServers({ user_settings: state })).toBe(first);

    const empty = init(userSettingsReducer);
    const firstEmpty = selectGlobalMcpServers({ user_settings: empty });
    expect(selectGlobalMcpServers({ user_settings: empty })).toBe(firstEmpty);
  });

  it("imports only MCP servers that have an address", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(
      state,
      importUserSettings({
        mcp_servers: [
          { id: "kept", name: "Files", url: "http://localhost:9000/mcp" },
          { id: "gateway", name: "GWDG", kind: "remote", serverId: "server-1" },
        ],
      }),
    );
    expect(state.mcp_servers).toEqual([
      { id: "kept", name: "Files", url: "http://localhost:9000/mcp" },
    ]);
  });

  it("validates memory mode and send shortcut", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(state, setMemoryMode(2));
    expect(state.memory_mode).toBe(2);
    state = userSettingsReducer(state, setMemoryMode(9));
    expect(state.memory_mode).toBe(2);
    state = userSettingsReducer(state, setSendWithEnter(false));
    expect(state.send_with_enter).toBe(false);
  });

  it("imports sanitized settings", () => {
    const state = userSettingsReducer(
      init(userSettingsReducer),
      importUserSettings({
        timeout: 1,
        memory_mode: 1,
        html_render_mode: "render",
        unknown: "ignored",
      }),
    );
    expect(state.timeout).toBe(5000);
    expect(state.memory_mode).toBe(1);
    expect(state.html_render_mode).toBe("render");
    expect(state.unknown).toBeUndefined();
  });

  it("validates the reasoning streaming preference", () => {
    let state = init(userSettingsReducer);
    expect(
      selectCollapseReasoningWhileStreaming({ user_settings: state }),
    ).toBe(true);

    state = userSettingsReducer(
      state,
      setCollapseReasoningWhileStreaming(false),
    );
    expect(state.collapse_reasoning_while_streaming).toBe(false);

    state = userSettingsReducer(
      state,
      importUserSettings({ collapse_reasoning_while_streaming: true }),
    );
    expect(state.collapse_reasoning_while_streaming).toBe(true);
  });

  it("toggles message timestamps and imports them", () => {
    let state = init(userSettingsReducer);
    expect(selectShowTimestamps({ user_settings: state })).toBe(false);

    state = userSettingsReducer(state, setShowTimestamps(true));
    expect(selectShowTimestamps({ user_settings: state })).toBe(true);

    state = userSettingsReducer(
      state,
      importUserSettings({ show_timestamps: false }),
    );
    expect(selectShowTimestamps({ user_settings: state })).toBe(false);
  });

  it("falls back to safe selector values", () => {
    expect(selectMemoryMode({ user_settings: { memory_mode: 99 } })).toBe(0);
    expect(selectConversationSummaries({ user_settings: {} })).toBe(true);
    expect(selectShowTimestamps({ user_settings: {} })).toBe(false);
    expect(selectAdvancedMode({ user_settings: {} })).toBe(false);
  });

  it("toggles advanced mode and restores it from an import", () => {
    let state = init(userSettingsReducer);
    expect(selectAdvancedMode({ user_settings: state })).toBe(false);

    state = userSettingsReducer(state, setAdvancedMode(true));
    expect(selectAdvancedMode({ user_settings: state })).toBe(true);

    state = userSettingsReducer(
      state,
      importUserSettings({ advanced_mode: false }),
    );
    expect(selectAdvancedMode({ user_settings: state })).toBe(false);
  });

  it("validates the MCP tool policy and falls back to ask", () => {
    let state = init(userSettingsReducer);
    expect(selectMcpToolPolicy({ user_settings: state })).toBe("ask");

    state = userSettingsReducer(state, setMcpToolPolicy("always"));
    expect(selectMcpToolPolicy({ user_settings: state })).toBe("always");

    state = userSettingsReducer(state, setMcpToolPolicy("sometimes"));
    expect(selectMcpToolPolicy({ user_settings: state })).toBe("always");

    state = userSettingsReducer(
      state,
      importUserSettings({ mcp_tool_policy: "never" }),
    );
    expect(state.mcp_tool_policy).toBe("never");

    state = userSettingsReducer(
      state,
      importUserSettings({ mcp_tool_policy: "bogus" }),
    );
    expect(state.mcp_tool_policy).toBe("never");

    expect(selectMcpToolPolicy({ user_settings: {} })).toBe("ask");
  });

  it("lets an explicit feedback choice override the deployment module", () => {
    vi.stubEnv("VITE_MODULE_FEEDBACK", "false");
    let state = init(userSettingsReducer);
    expect(state.feedback_enabled).toBeNull();
    // Unset follows the deployment, which has the module off here.
    expect(selectFeedbackEnabled({ user_settings: state })).toBe(false);

    state = userSettingsReducer(state, setFeedbackEnabled(true));
    expect(state.feedback_enabled).toBe(true);
    expect(selectFeedbackEnabled({ user_settings: state })).toBe(true);

    state = userSettingsReducer(state, setFeedbackEnabled(false));
    expect(selectFeedbackEnabled({ user_settings: state })).toBe(false);

    // An import keeps a boolean and an explicit null; anything else is ignored.
    state = userSettingsReducer(
      state,
      importUserSettings({ feedback_enabled: null }),
    );
    expect(state.feedback_enabled).toBeNull();
    state = userSettingsReducer(
      state,
      importUserSettings({ feedback_enabled: "yes" }),
    );
    expect(state.feedback_enabled).toBeNull();
    vi.unstubAllEnvs();
  });

  it("sends chat transcripts by default and can stop them", () => {
    let state = init(userSettingsReducer);
    expect(state.feedback_send_transcripts).toBe(true);
    expect(selectFeedbackSendTranscripts({ user_settings: state })).toBe(true);

    state = userSettingsReducer(state, setFeedbackSendTranscripts(false));
    expect(selectFeedbackSendTranscripts({ user_settings: state })).toBe(false);

    // An import keeps a boolean and ignores anything else.
    state = userSettingsReducer(
      state,
      importUserSettings({ feedback_send_transcripts: "no" }),
    );
    expect(selectFeedbackSendTranscripts({ user_settings: state })).toBe(false);
    state = userSettingsReducer(
      state,
      importUserSettings({ feedback_send_transcripts: true }),
    );
    expect(selectFeedbackSendTranscripts({ user_settings: state })).toBe(true);

    // A profile stored before the setting existed follows the default (on).
    expect(selectFeedbackSendTranscripts({ user_settings: {} })).toBe(true);
  });

  it("toggles diagram rendering preferences and imports them", () => {    let state = init(userSettingsReducer);
    expect(selectRenderGraphviz({ user_settings: state })).toBe(false);
    expect(selectRenderVega({ user_settings: state })).toBe(false);
    expect(selectRenderChartjs({ user_settings: state })).toBe(false);

    state = userSettingsReducer(state, setRenderGraphviz(true));
    state = userSettingsReducer(state, setRenderVega(true));
    state = userSettingsReducer(state, setRenderChartjs(true));
    expect(selectRenderGraphviz({ user_settings: state })).toBe(true);
    expect(selectRenderVega({ user_settings: state })).toBe(true);
    expect(selectRenderChartjs({ user_settings: state })).toBe(true);

    state = userSettingsReducer(
      state,
      importUserSettings({
        render_graphviz: false,
        render_vega: false,
        render_chartjs: false,
      }),
    );
    expect(selectRenderGraphviz({ user_settings: state })).toBe(false);
    expect(selectRenderVega({ user_settings: state })).toBe(false);
    expect(selectRenderChartjs({ user_settings: state })).toBe(false);
  });

  it("stores encryption keys and model bindings, and drops dangling ones", () => {
    let state = init(userSettingsReducer);
    expect(selectE2eeKeys({ user_settings: state })).toEqual([]);
    expect(selectE2eeModels({ user_settings: state })).toEqual({});

    state = userSettingsReducer(
      state,
      addE2eeKey({
        id: "node-a",
        name: "Node A",
        publicKey: "  abc  ",
        source: "paste",
        // Derived data is not trusted; it is recomputed from the key.
        kid: "stale",
        // The last sealed test is stored with the key so the list can show it
        // green, and only well-formed model ids are kept.
        testedAt: "2026-01-01T00:00:00.000Z",
        testedModels: ["qwen-a", "", 7],
      }),
    );
    expect(selectE2eeKeys({ user_settings: state })[0]).toMatchObject({
      id: "node-a",
      name: "Node A",
      publicKey: "abc",
      source: "paste",
      testedAt: "2026-01-01T00:00:00.000Z",
      testedModels: ["qwen-a"],
    });
    expect(selectE2eeKeys({ user_settings: state })[0].kid).toBeUndefined();

    state = userSettingsReducer(
      state,
      updateE2eeKey({ id: "node-a", patch: { name: "Renamed" } }),
    );
    expect(selectE2eeKeys({ user_settings: state })[0].name).toBe("Renamed");

    state = userSettingsReducer(
      state,
      setE2eeModelKey({ modelId: "qwen-a", keyId: "node-a" }),
    );
    expect(selectE2eeModels({ user_settings: state })).toEqual({
      "qwen-a": "node-a",
    });

    // A binding can only name an existing key.
    state = userSettingsReducer(
      state,
      setE2eeModelKey({ modelId: "qwen-a", keyId: "missing" }),
    );
    expect(selectE2eeModels({ user_settings: state })).toEqual({
      "qwen-a": "node-a",
    });

    // Removing the key removes the binding, so the model is not left keyed
    // without a key (which would fail closed).
    state = userSettingsReducer(state, removeE2eeKey("node-a"));
    expect(selectE2eeKeys({ user_settings: state })).toEqual([]);
    expect(selectE2eeModels({ user_settings: state })).toEqual({});
  });

  it("clears every key and binding in one step", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(
      state,
      addE2eeKey({ id: "node-a", name: "Node A", publicKey: "abc" }),
    );
    state = userSettingsReducer(
      state,
      setE2eeModelKey({ modelId: "qwen-a", keyId: "node-a" }),
    );

    state = userSettingsReducer(state, clearE2eeKeys());

    expect(selectE2eeKeys({ user_settings: state })).toEqual([]);
    expect(selectE2eeModels({ user_settings: state })).toEqual({});
  });

  it("sanitises imported encryption keys and bindings", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(
      state,
      importUserSettings({
        e2ee_keys: [
          {
            id: "node-a",
            publicKey: "abc",
            secret: "do-not-import",
            testedAt: "2026-01-01T00:00:00.000Z",
            testedModels: ["qwen-a", 42],
          },
          { id: "", publicKey: "abc" },
          { id: "node-b", publicKey: "   " },
        ],
        e2ee_models: { "qwen-a": "node-a", "qwen-b": "node-missing" },
      }),
    );

    expect(selectE2eeKeys({ user_settings: state })).toHaveLength(1);
    expect(selectE2eeKeys({ user_settings: state })[0]).not.toHaveProperty(
      "secret",
    );
    // A backup keeps the test record, so an imported key does not have to be
    // re-tested to show what was already known.
    expect(selectE2eeKeys({ user_settings: state })[0].testedModels).toEqual([
      "qwen-a",
    ]);
    // A binding to an unknown key is dropped instead of becoming a trap.
    expect(selectE2eeModels({ user_settings: state })).toEqual({
      "qwen-a": "node-a",
    });
  });

  it("returns a stable empty list for old interface settings", () => {
    const state = { interface_settings: {} };
    expect(selectSuppressedTutorials(state)).toBe(
      selectSuppressedTutorials(state),
    );
  });
});

describe("interface settings reducer", () => {
  it("toggles theme and records accepted disclaimers", () => {
    let state = init(interfaceSettingsReducer);
    expect(state.dark_mode).toBe(false);
    state = interfaceSettingsReducer(state, toggleTheme());
    expect(state.dark_mode).toBe(true);
    state = interfaceSettingsReducer(state, agreeWebSearch());
    expect(selectAgreeWebSearch({ interface_settings: state })).toBe(true);
  });

  it("validates conversation grouping", () => {
    let state = init(interfaceSettingsReducer);
    state = interfaceSettingsReducer(state, setConversationGrouping("date"));
    expect(selectConversationGrouping({ interface_settings: state })).toBe("date");
    state = interfaceSettingsReducer(state, setConversationGrouping("size"));
    expect(selectConversationGrouping({ interface_settings: state })).toBe("size");
    state = interfaceSettingsReducer(state, setConversationGrouping("invalid"));
    expect(selectConversationGrouping({ interface_settings: state })).toBe("size");
  });

  it("tracks completed and suppressed tutorials without duplicates", () => {
    let state = init(interfaceSettingsReducer);
    state = interfaceSettingsReducer(state, markTutorialCompleted("upload_file"));
    state = interfaceSettingsReducer(state, markTutorialCompleted("upload_file"));
    state = interfaceSettingsReducer(state, markUseCaseCompleted("uc-1"));
    state = interfaceSettingsReducer(state, suppressTutorial("upload_file"));
    expect(state.completed_tutorials).toEqual(["upload_file"]);
    expect(state.completed_use_cases).toEqual(["uc-1"]);
    expect(state.suppressed_tutorials).toEqual(["upload_file"]);
  });

  it("sets warning flags", () => {
    const state = interfaceSettingsReducer(
      init(interfaceSettingsReducer),
      setWarning({ key: "warn_fork", value: false }),
    );
    expect(state.warn_fork).toBe(false);
  });

  it("stores a brand theme and falls back to the default on a bad value", () => {
    let state = init(interfaceSettingsReducer);
    expect(selectBrandTheme({ interface_settings: state })).toBe("default");
    state = interfaceSettingsReducer(state, setBrandTheme("business"));
    expect(selectBrandTheme({ interface_settings: state })).toBe("business");
    state = interfaceSettingsReducer(state, setBrandTheme("  green  "));
    expect(state.theme).toBe("green");
    state = interfaceSettingsReducer(state, setBrandTheme(""));
    expect(state.theme).toBe("default");
    state = interfaceSettingsReducer(state, setBrandTheme(42));
    expect(state.theme).toBe("default");
    // Old persisted state without the key still reads as the default pair.
    expect(selectBrandTheme({ interface_settings: {} })).toBe("default");
  });

  it("records a consent acceptance per brand and sanitizes its payload", () => {
    let state = init(interfaceSettingsReducer);
    expect(selectBrandConsent("gaia")({ interface_settings: state })).toBeNull();

    state = interfaceSettingsReducer(
      state,
      acceptBrandConsent({
        brandId: "gaia",
        version: "2026-02",
        answers: { surveys: true, logging: false, junk: "yes" },
        acceptedAt: "2026-02-01T10:00:00.000Z",
      }),
    );
    const record = selectBrandConsent("gaia")({ interface_settings: state });
    expect(record).toEqual({
      version: "2026-02",
      answers: { surveys: true, logging: false, junk: true },
      acceptedAt: "2026-02-01T10:00:00.000Z",
    });
    // A second brand keeps its own record.
    state = interfaceSettingsReducer(
      state,
      acceptBrandConsent({ brandId: "other", version: 3, answers: null }),
    );
    expect(state.consent_acceptance.other.version).toBe("3");
    expect(state.consent_acceptance.other.answers).toEqual({});
    expect(state.consent_acceptance.other.acceptedAt).toMatch(/^\d{4}-/);

    // A payload without a brand id changes nothing.
    const before = state;
    state = interfaceSettingsReducer(state, acceptBrandConsent({ version: "1" }));
    expect(state).toBe(before);
  });

  it("collapses and expands topic groups in bulk without duplicates", () => {
    let state = init(interfaceSettingsReducer);
    state = interfaceSettingsReducer(state, collapseTopics(["t1", "t2"]));
    state = interfaceSettingsReducer(state, collapseTopics(["t2", "t3"]));
    expect(state.collapsed_topics).toEqual(["t1", "t2", "t3"]);

    // Expanding only drops the ids it was given; other sections stay collapsed.
    state = interfaceSettingsReducer(state, collapseTopics("__pinned__"));
    state = interfaceSettingsReducer(state, expandTopics(["t1", "t2"]));
    expect(state.collapsed_topics).toEqual(["t3", "__pinned__"]);
  });

  it("applies a synced payload without touching device-local keys", () => {
    const start = {
      ...init(interfaceSettingsReducer),
      show_sidebar: false,
      collapsed_topics: ["topic-1"],
      expanded_agents: ["agent-1"],
      agree_web_search: false,
      sync_onboarding_dismissed: true,
      count_hallucination: 3,
      theme: "business",
      consent_acceptance: {
        gaia: {
          version: "2026-02",
          answers: { surveys: true },
          acceptedAt: "2026-02-01T10:00:00.000Z",
        },
      },
    };
    const state = interfaceSettingsReducer(
      start,
      importInterfaceSettings({
        dark_mode: true,
        conversation_sort: "title_asc",
        conversation_grouping: "date",
        completed_tutorials: ["upload_file", 7, ""],
        show_tour: false,
        // A payload must not be able to rewrite this window's view state, its
        // consent or the first-run offer decision.
        show_sidebar: true,
        collapsed_topics: [],
        expanded_agents: [],
        agree_web_search: true,
        sync_onboarding_dismissed: false,
        count_hallucination: 0,
        theme: "green",
        consent_acceptance: {},
        not_a_setting: "value",
      }),
    );

    expect(state.dark_mode).toBe(true);
    expect(state.conversation_sort).toBe("title_asc");
    expect(state.conversation_grouping).toBe("date");
    expect(state.completed_tutorials).toEqual(["upload_file"]);
    expect(state.show_tour).toBe(false);

    expect(state.show_sidebar).toBe(false);
    expect(state.collapsed_topics).toEqual(["topic-1"]);
    expect(state.expanded_agents).toEqual(["agent-1"]);
    expect(state.agree_web_search).toBe(false);
    expect(state.sync_onboarding_dismissed).toBe(true);
    expect(state.count_hallucination).toBe(3);
    expect(state.theme).toBe("business");
    expect(state.consent_acceptance.gaia.answers).toEqual({ surveys: true });
    expect(state).not.toHaveProperty("not_a_setting");
  });

  it("rejects wrongly typed values and unknown groupings from a pull", () => {
    const state = interfaceSettingsReducer(
      init(interfaceSettingsReducer),
      importInterfaceSettings({
        dark_mode: "yes",
        conversation_sort: 7,
        conversation_grouping: "gallery",
        completed_tutorials: "upload_file",
      }),
    );
    expect(state.dark_mode).toBe(false);
    expect(state.conversation_sort).toBe("created_desc");
    expect(state.conversation_grouping).toBe("topic");
    expect(state.completed_tutorials).toEqual([]);
  });
});

describe("deployment user settings defaults", () => {
  // The value arrives as VITE_USER_SETTINGS (JSON) from `userSettings` in front.json.
  const stubSettings = (value) => {
    vi.stubEnv(
      "VITE_USER_SETTINGS",
      value === undefined ? undefined : JSON.stringify(value),
    );
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the built-in defaults when the config sets nothing", () => {
    stubSettings(undefined);
    const settings = getDefaultUserSettings();
    expect(settings.memory_mode).toBe(0);
    expect(settings.advanced_mode).toBe(false);
    expect(settings.mcp_tool_policy).toBe("ask");
    expect(settings.send_with_enter).toBeNull();
    expect(settings.timeout).toBe(300000);
    expect(settings.memories).toEqual([]);
    expect(settings.e2ee_models).toEqual({});
  });

  it("applies valid overrides from the config", () => {
    stubSettings({
      memory_mode: 2,
      advanced_mode: true,
      suggest_user_prompts: true,
      send_with_enter: false,
      mcp_tool_policy: "never",
      document_conversion_mode: "browser",
      timeout: 45000,
    });
    const settings = getDefaultUserSettings();
    expect(settings.memory_mode).toBe(2);
    expect(settings.advanced_mode).toBe(true);
    expect(settings.suggest_user_prompts).toBe(true);
    expect(settings.send_with_enter).toBe(false);
    expect(settings.mcp_tool_policy).toBe("never");
    expect(settings.document_conversion_mode).toBe("browser");
    expect(settings.timeout).toBe(45000);
  });

  it("ignores unknown keys, wrong types, and out-of-range values", () => {
    stubSettings({
      not_a_setting: "ignored",
      memory_mode: 9,
      mcp_tool_policy: "sometimes",
      html_sanitization: "loose",
      advanced_mode: "yes",
      timeout: 1,
    });
    const settings = getDefaultUserSettings();
    expect(settings).not.toHaveProperty("not_a_setting");
    expect(settings.memory_mode).toBe(0);
    expect(settings.mcp_tool_policy).toBe("ask");
    expect(settings.html_sanitization).toBe("strict");
    expect(settings.advanced_mode).toBe(false);
    // Clamped to the 5 s minimum by the shared import validation.
    expect(settings.timeout).toBe(5000);
  });

  it("falls back to the defaults when the config value is not usable", () => {
    for (const raw of ["{not json", "[]", "null", "42", "true"]) {
      vi.stubEnv("VITE_USER_SETTINGS", raw);
      const settings = getDefaultUserSettings();
      expect(settings.memory_mode).toBe(0);
      expect(settings.mcp_tool_policy).toBe("ask");
    }
  });

  it("keeps the reducer's initial state independent of later env changes", () => {
    const state = init(userSettingsReducer);
    stubSettings({ memory_mode: 2, advanced_mode: true });
    expect(state.memory_mode).toBe(0);
    expect(state.advanced_mode).toBe(false);
  });
});
