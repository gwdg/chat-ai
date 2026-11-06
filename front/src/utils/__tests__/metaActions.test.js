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
    ].join("\n");
    expect(stripMetaActionMarkers(text)).toBe("Done.");
  });
});
