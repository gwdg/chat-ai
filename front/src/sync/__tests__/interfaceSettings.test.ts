import { describe, expect, it } from "vitest";

import { hashPayload } from "../canonical";
import {
  INTERFACE_SETTINGS_RECORD_ID,
  createInterfaceSettingsNamespace,
  type InterfaceSettingsAccess,
} from "../namespaces/interfaceSettings";

/**
 * Interface settings are one record, merged per key against the last agreed
 * payload. The checks below are the two rules a pulled record must satisfy:
 * nothing device-local travels, and a pull hashes back to the record.
 */
const accessWith = (initial: Record<string, any>) => {
  const state = { value: { ...initial } };
  const access: InterfaceSettingsAccess = {
    read: () => state.value,
    apply: (payload) => {
      state.value = { ...state.value, ...payload };
    },
  };
  return { state, access };
};

const remoteOf = (record: any) => ({
  namespace: "interface_settings",
  id: record.id,
  rev: 1,
  hash: record.hash,
  payload: record.payload,
  deviceId: "dev-a",
});

describe("interface settings namespace", () => {
  it("leaves this device's view state out of the record", async () => {
    const { access } = accessWith({
      dark_mode: true,
      conversation_sort: "title_asc",
      completed_tutorials: ["upload_file"],
      show_sidebar: false,
      show_settings: true,
      collapsed_topics: ["topic-1"],
      expanded_agents: ["agent-1"],
      count_hallucination: 4,
      count_announcement: 2,
      agree_web_search: true,
      sync_onboarding_dismissed: true,
    });
    const namespace = createInterfaceSettingsNamespace(access);

    const [record] = await namespace.list();

    expect(record.id).toBe(INTERFACE_SETTINGS_RECORD_ID);
    expect(record.payload).toEqual({
      dark_mode: true,
      conversation_sort: "title_asc",
      completed_tutorials: ["upload_file"],
    });
    for (const key of [
      "show_sidebar",
      "show_settings",
      "collapsed_topics",
      "expanded_agents",
      "count_hallucination",
      "count_announcement",
      "agree_web_search",
      "sync_onboarding_dismissed",
    ]) {
      expect(record.payload).not.toHaveProperty(key);
    }
  });

  it("hashes back to the pulled payload", async () => {
    const { state, access } = accessWith({ dark_mode: false });
    const namespace = createInterfaceSettingsNamespace(access);
    const remote = {
      ...remoteOf({
        id: INTERFACE_SETTINGS_RECORD_ID,
        hash: "",
        payload: {
          dark_mode: true,
          conversation_grouping: "date",
          completed_use_cases: ["uc-1"],
        },
      }),
    };
    remote.hash = hashPayload(remote.payload);

    await namespace.apply(remote);

    const [record] = await namespace.list();
    expect(record.hash).toBe(remote.hash);
    // The device-local sidebar flag is untouched by the pull.
    expect(state.value.show_sidebar).toBeUndefined();
  });

  it("merges a remote-only change with a local one and pushes the result", async () => {
    const base = {
      dark_mode: false,
      conversation_sort: "created_desc",
      conversation_grouping: "topic",
    };
    const { state, access } = accessWith({
      ...base,
      conversation_grouping: "date",
    });
    const namespace = createInterfaceSettingsNamespace(access);

    const [local] = await namespace.list();
    const remote = {
      ...remoteOf(local),
      payload: { ...base, conversation_sort: "title_asc" },
    };
    remote.hash = hashPayload(remote.payload);

    const result = await namespace.merge(local, remote, {
      namespace: "interface_settings",
      id: INTERFACE_SETTINGS_RECORD_ID,
      rev: 1,
      hash: hashPayload(base),
      payload: base,
    });

    // Both edits survive; the remote did not touch the grouping, and the
    // merged version (not the remote one) is what the next push carries.
    expect(result).not.toBe("remote");
    expect((result as any).payload).toEqual({
      dark_mode: false,
      conversation_grouping: "date",
      conversation_sort: "title_asc",
    });
    expect(state.value.conversation_grouping).toBe("date");
    expect(state.value.conversation_sort).toBe("title_asc");
    expect(namespace.takeConflicts?.()).toEqual([]);
  });

  it("keeps the local value and reports a key changed on both sides", async () => {
    const base = {
      conversation_grouping: "topic",
      conversation_sort: "created_desc",
    };
    const { access } = accessWith({
      ...base,
      conversation_grouping: "date",
    });
    const namespace = createInterfaceSettingsNamespace(access);

    const [local] = await namespace.list();
    const remote = {
      ...remoteOf(local),
      payload: {
        conversation_grouping: "created",
        conversation_sort: "title_asc",
      },
    };
    remote.hash = hashPayload(remote.payload);

    const result = await namespace.merge(local, remote, {
      namespace: "interface_settings",
      id: INTERFACE_SETTINGS_RECORD_ID,
      rev: 1,
      hash: hashPayload(base),
      payload: base,
    });

    // Both devices changed the grouping differently: this device's value wins
    // and the conflict is reported instead of the list flipping silently.
    expect(result).not.toBe("remote");
    expect((result as any).payload.conversation_grouping).toBe("date");
    expect((result as any).payload.conversation_sort).toBe("title_asc");
    expect(namespace.takeConflicts?.()).toEqual([
      {
        namespace: "interface_settings",
        id: INTERFACE_SETTINGS_RECORD_ID,
        title: "conversation_grouping",
        reason: "merge",
      },
    ]);
  });
});
