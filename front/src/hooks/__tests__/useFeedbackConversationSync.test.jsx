import { act, renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import userSettingsReducer, {
  setFeedbackFullTranscript,
} from "../../Redux/reducers/userSettingsReducer";
import {
  transcriptHash,
  writeFeedbackCursor,
} from "../../utils/feedbackCursor";
import { useFeedbackConversationSync } from "../useFeedbackConversationSync";

const api = vi.hoisted(() => ({
  isChatFeedbackEnabled: vi.fn(() => true),
  feedbackMessagesFromConversation: vi.fn((messages) =>
    (messages ?? []).filter(
      (message) => message?.role === "user" || message?.role === "assistant",
    ),
  ),
  submitConversationAnalysis: vi.fn(async () => ({ id: "x" })),
}));

vi.mock("../../apis/feedback", () => ({
  isChatFeedbackEnabled: api.isChatFeedbackEnabled,
  feedbackMessagesFromConversation: api.feedbackMessagesFromConversation,
  submitConversationAnalysis: api.submitConversationAnalysis,
}));

const conversation = (overrides = {}) => ({
  id: "conv-1",
  title: "A chat",
  messages: [
    { id: "m1", role: "user", content: "Question" },
    { id: "m2", role: "assistant", content: "Answer" },
  ],
  settings: { model: "deepseek" },
  ...overrides,
});

const storeFor = (feedbackEnabled = true, fullTranscript = true) =>
  configureStore({
    reducer: { user_settings: userSettingsReducer },
    preloadedState: {
      user_settings: {
        ...userSettingsReducer(undefined, { type: "@@INIT" }),
        feedback_enabled: feedbackEnabled,
        feedback_full_transcript: fullTranscript,
      },
    },
  });

const wrapperForStore = (store) =>
  ({ children }) => <Provider store={store}>{children}</Provider>;

const wrapperFor = (feedbackEnabled = true, fullTranscript = true) =>
  wrapperForStore(storeFor(feedbackEnabled, fullTranscript));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  api.isChatFeedbackEnabled.mockReturnValue(true);
  api.submitConversationAnalysis.mockReset();
  api.submitConversationAnalysis.mockImplementation(async () => ({ id: "x" }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useFeedbackConversationSync", () => {
  it("does not send the conversation it was opened with", async () => {
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(true), initialProps: { state: conversation() } },
    );
    rerender({ state: conversation() });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(api.submitConversationAnalysis).not.toHaveBeenCalled();
  });

  it("sends a finished change once, after the debounce", async () => {
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(true), initialProps: { state: conversation() } },
    );

    const changed = conversation({
      messages: [
        ...conversation().messages,
        { id: "m3", role: "user", content: "Follow-up" },
        { id: "m4", role: "assistant", content: "Second answer" },
      ],
    });
    rerender({ state: changed });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3999);
    });
    expect(api.submitConversationAnalysis).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(api.submitConversationAnalysis).toHaveBeenCalledTimes(1);
    expect(api.submitConversationAnalysis.mock.calls[0][0]).toMatchObject({
      model: "deepseek",
    });

    // The same state re-rendered is not a new change.
    rerender({ state: changed });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.submitConversationAnalysis).toHaveBeenCalledTimes(1);
  });

  it("waits for a streaming reply to finish", async () => {
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(true), initialProps: { state: conversation() } },
    );

    const streaming = conversation({
      messages: [
        ...conversation().messages,
        { id: "m3", role: "assistant", content: "Partial", loading: true },
      ],
    });
    rerender({ state: streaming });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.submitConversationAnalysis).not.toHaveBeenCalled();

    rerender({
      state: conversation({
        messages: [
          ...conversation().messages,
          { id: "m3", role: "assistant", content: "Complete" },
        ],
      }),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(api.submitConversationAnalysis).toHaveBeenCalledTimes(1);
  });

  it("sends nothing while the feature is off", async () => {
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(false), initialProps: { state: conversation() } },
    );

    const changed = conversation({
      messages: [
        ...conversation().messages,
        { id: "m3", role: "user", content: "While off" },
      ],
    });
    rerender({ state: changed });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.submitConversationAnalysis).not.toHaveBeenCalled();
  });

  it("never sends the Meta chat", async () => {
    const meta = conversation({ id: "meta-chat", isMetaChat: true });
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(true), initialProps: { state: meta } },
    );
    rerender({
      state: {
        ...meta,
        messages: [
          ...meta.messages,
          { id: "m3", role: "user", content: "Meta question" },
        ],
      },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.submitConversationAnalysis).not.toHaveBeenCalled();
  });

  const settle = async () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

  const turn = (number) => [
    { id: `u${number}`, role: "user", content: `Question ${number}` },
    { id: `a${number}`, role: "assistant", content: `Answer ${number}` },
  ];

  const cursorForOpenedChat = (messages) =>
    writeFeedbackCursor("conv-1", {
      count: messages.length,
      hash: transcriptHash(api.feedbackMessagesFromConversation(messages)),
    });

  it("sends the whole transcript by default", async () => {
    const opened = conversation();
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(true, true), initialProps: { state: opened } },
    );

    rerender({
      state: conversation({ messages: [...opened.messages, ...turn(3)] }),
    });
    await settle();

    const sent = api.submitConversationAnalysis.mock.calls[0][0];
    expect(sent).toMatchObject({ mode: "full", offset: 0 });
    expect(sent.messages).toHaveLength(4);
  });

  it("sends only the new turns when whole transcripts are off", async () => {
    const opened = conversation();
    cursorForOpenedChat(opened.messages);
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(true, false), initialProps: { state: opened } },
    );

    const four = conversation({ messages: [...opened.messages, ...turn(3)] });
    rerender({ state: four });
    await settle();

    const first = api.submitConversationAnalysis.mock.calls[0][0];
    expect(first).toMatchObject({ mode: "delta", offset: 2 });
    expect(first.messages.map((message) => message.id)).toEqual(["u3", "a3"]);

    // The cursor now covers four turns, so the next change continues at four.
    rerender({
      state: conversation({ messages: [...four.messages, ...turn(4)] }),
    });
    await settle();

    const second = api.submitConversationAnalysis.mock.calls[1][0];
    expect(second).toMatchObject({ mode: "delta", offset: 4 });
    expect(second.messages.map((message) => message.id)).toEqual(["u4", "a4"]);
  });

  it("resends the whole transcript when the receiver rejects a delta", async () => {
    const opened = conversation();
    cursorForOpenedChat(opened.messages);
    api.submitConversationAnalysis
      .mockRejectedValueOnce(
        Object.assign(new Error("stale"), { code: "conflict" }),
      )
      .mockResolvedValueOnce({ id: "x" });
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(true, false), initialProps: { state: opened } },
    );

    rerender({
      state: conversation({ messages: [...opened.messages, ...turn(3)] }),
    });
    await settle();

    expect(api.submitConversationAnalysis).toHaveBeenCalledTimes(2);
    expect(api.submitConversationAnalysis.mock.calls[0][0]).toMatchObject({
      mode: "delta",
      offset: 2,
    });
    const retry = api.submitConversationAnalysis.mock.calls[1][0];
    expect(retry).toMatchObject({ mode: "delta", offset: 0 });
    expect(retry.messages).toHaveLength(4);
  });

  it("sends the whole transcript when an earlier turn changed", async () => {
    const opened = conversation();
    cursorForOpenedChat(opened.messages);
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperFor(true, false), initialProps: { state: opened } },
    );

    rerender({
      state: conversation({
        messages: [
          { ...opened.messages[0], content: "An edited question" },
          opened.messages[1],
          ...turn(3),
        ],
      }),
    });
    await settle();

    const sent = api.submitConversationAnalysis.mock.calls[0][0];
    expect(sent).toMatchObject({ mode: "delta", offset: 0 });
    expect(sent.messages).toHaveLength(4);
  });

  it("keeps using the same chat after switching to deltas", async () => {
    const store = storeFor(true, true);
    const opened = conversation();
    const { rerender } = renderHook(
      ({ state }) => useFeedbackConversationSync(state),
      { wrapper: wrapperForStore(store), initialProps: { state: opened } },
    );

    const four = conversation({ messages: [...opened.messages, ...turn(3)] });
    rerender({ state: four });
    await settle();
    expect(api.submitConversationAnalysis.mock.calls[0][0]).toMatchObject({
      mode: "full",
    });

    await act(async () => {
      store.dispatch(setFeedbackFullTranscript(false));
    });
    rerender({
      state: conversation({ messages: [...four.messages, ...turn(4)] }),
    });
    await settle();

    const second = api.submitConversationAnalysis.mock.calls[1][0];
    expect(second).toMatchObject({ mode: "delta", offset: 4 });
    expect(second.messages.map((message) => message.id)).toEqual(["u4", "a4"]);
  });
});
