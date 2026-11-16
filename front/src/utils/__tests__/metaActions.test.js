import { describe, expect, it } from "vitest";
import {
  getMetaActionProposals,
  stripMetaActionMarkers,
} from "../metaActions";

describe("Meta chat action markers", () => {
  it("parses chat, topic, settings, MCP, and memory proposals", () => {
    const text = [
      '[[RENAME_CHAT:{"id":"c1","title":"New title"}]]',
      '[[MOVE_CHAT:{"id":"c2","folderId":"f1"}]]',
      '[[PIN_CHAT:{"id":"c3","pinned":true}]]',
      '[[PIN_TOPIC:{"id":"f1","pinned":false}]]',
      '[[SET_SETTING:{"key":"render_typst","value":true}]]',
      '[[SET_CONVERSATION_SETTING:{"target":"all","key":"temperature","value":0.7}]]',
      '[[MCP_SERVER:{"op":"add","server":"local","target":"all","url":"localhost:9000","enabled":true}]]',
      '[[ADD_MEMORY:{"text":"remember this"}]]',
      '[[DELETE_MEMORY:{"index":1}]]',
    ].join("\n");

    const proposals = getMetaActionProposals(text);
    expect(proposals).toHaveLength(9);
    expect(proposals[0]).toMatchObject({ type: "rename", conversationId: "c1", title: "New title" });
    expect(proposals[1]).toMatchObject({ type: "move", conversationId: "c2", folderId: "f1" });
    expect(proposals[2]).toMatchObject({ type: "pin", conversationId: "c3", pinned: true });
    expect(proposals[3]).toMatchObject({ type: "pin_topic", topicId: "f1", pinned: false });
    expect(proposals[4]).toMatchObject({ type: "setting", key: "render_typst", value: true });
    expect(proposals[5]).toMatchObject({
      type: "conversation_setting",
      scope: "all",
      key: "temperature",
      value: 0.7,
    });
    expect(proposals[6]).toMatchObject({
      type: "mcp_server",
      op: "add",
      serverScope: "local",
      url: "localhost:9000",
    });
    expect(proposals[7]).toMatchObject({ type: "add_memory", text: "remember this" });
    expect(proposals[8]).toMatchObject({ type: "delete_memory", index: 1 });
  });

  it("parses global MCP server proposals", () => {
    const proposals = getMetaActionProposals(
      '[[MCP_SERVER:{"op":"add","server":"local","target":"global","name":"Files","url":"localhost:9000"}]]',
    );
    expect(proposals).toEqual([
      {
        type: "mcp_server",
        op: "add",
        serverScope: "local",
        scope: "global",
        conversationId: null,
        entryId: "",
        name: "Files",
        url: "localhost:9000",
        serverId: "",
        enabled: undefined,
        authorization: undefined,
      },
    ]);
  });

  it("parses workspace and agent pin proposals", () => {
    const proposals = getMetaActionProposals(
      [
        '[[PIN_WORKSPACE:{"id":"w1","pinned":true}]]',
        '[[PIN_AGENT:{"id":"a1","value":false}]]',
      ].join("\n"),
    );

    expect(proposals).toEqual([
      { type: "pin_workspace", workspaceId: "w1", pinned: true },
      { type: "pin_agent", agentId: "a1", pinned: false },
    ]);
  });

  it("requires an id and a boolean pinned value for the new pin proposals", () => {
    const proposals = getMetaActionProposals(
      [
        '[[PIN_WORKSPACE:{"id":"","pinned":true}]]',
        '[[PIN_AGENT:{"id":"a1"}]]',
      ].join("\n"),
    );

    expect(proposals).toEqual([]);
  });

  it("parses well-formed CREATE_CHAT proposals", () => {
    const proposals = getMetaActionProposals(
      '[[CREATE_CHAT:{"title":"Plan","folderName":"Work","settings":{"model":"m1","temperature":0.7,"tools":{"web_search":true}},"messages":[{"role":"system","content":"Be concise"},{"role":"user","content":"Start"}]}]]',
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      type: "create_chat",
      title: "Plan",
      folderName: "Work",
      settings: { model: "m1", temperature: 0.7, tools: { web_search: true } },
      messages: [
        { role: "system", text: "Be concise" },
        { role: "user", text: "Start" },
      ],
    });
  });

  it("rejects malformed CREATE_CHAT proposals", () => {
    const proposals = getMetaActionProposals(
      '[[CREATE_CHAT:{"title":"Bad","messages":[{"role":"tool","content":"nope"}]}]]',
    );
    expect(proposals).toEqual([]);
  });

  it("accepts an optional target group for memory proposals", () => {
    const proposals = getMetaActionProposals(
      '[[ADD_MEMORY:{"text":"remember this","group":"Private"}]]',
    );
    expect(proposals).toEqual([
      { type: "add_memory", text: "remember this", group: "Private" },
    ]);
  });

  it("accepts the browser storage tool setting", () => {
    const proposals = getMetaActionProposals(
      '[[SET_CONVERSATION_SETTING:{"id":"c1","key":"browser_storage","value":true}]]',
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      type: "conversation_setting",
      scope: "conversation",
      conversationId: "c1",
      key: "browser_storage",
      value: true,
    });
  });

  it("accepts the workspace writing tool setting", () => {
    const proposals = getMetaActionProposals(
      '[[SET_CONVERSATION_SETTING:{"id":"c1","key":"workspace_write_access","value":false}]]',
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      type: "conversation_setting",
      scope: "conversation",
      conversationId: "c1",
      key: "workspace_write_access",
      value: false,
    });
  });

  it("accepts the Arcana Tools tool setting", () => {
    const proposals = getMetaActionProposals(
      '[[SET_CONVERSATION_SETTING:{"id":"c1","key":"arcana_tools","value":true}]]',
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      type: "conversation_setting",
      scope: "conversation",
      conversationId: "c1",
      key: "arcana_tools",
      value: true,
    });
  });

  it("accepts the reasoning streaming preference", () => {
    const proposals = getMetaActionProposals(
      '[[SET_SETTING:{"key":"collapse_reasoning_while_streaming","value":true}]]',
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      type: "setting",
      key: "collapse_reasoning_while_streaming",
      value: true,
    });
  });

  it("ignores unsupported settings and malformed actions", () => {
    const text = [
      '[[SET_SETTING:{"key":"not_a_setting","value":true}]]',
      '[[SET_CONVERSATION_SETTING:{"target":"all","key":"temperature","value":9}]]',
      '[[MCP_SERVER:{"op":"add","server":"local","target":"all","url":"","enabled":true}]]',
      '[[RENAME_CHAT:{"id":"","title":"No id"}]]',
    ].join("\n");
    expect(getMetaActionProposals(text)).toEqual([]);
  });

  it("strips all action markers from rendered text", () => {
    const text = [
      "Done.",
      '[[RENAME_CHAT:{"id":"c1","title":"New"}]]',
      '[[MCP_SERVER:{"op":"remove","server":"remote","target":"all","serverId":"server-1"}]]',
      '[[PIN_CHAT:{"id":"c1","pinned":true}]]',
      '[[PIN_WORKSPACE:{"id":"w1","pinned":true}]]',
      '[[PIN_AGENT:{"id":"a1","pinned":false}]]',
    ].join("\n");
    expect(stripMetaActionMarkers(text)).toBe("Done.");
  });
});
