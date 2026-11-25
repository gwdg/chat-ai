import { act, renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import userSettingsReducer from "../../Redux/reducers/userSettingsReducer";
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

const wrapperFor = (feedbackEnabled = true) => {
  const store = configureStore({
    reducer: { user_settings: userSettingsReducer },
    preloadedState: {
      user_settings: { ...userSettingsReducer(undefined, { type: "@@INIT" }), feedback_enabled: feedbackEnabled },
    },
  });
  return ({ children }) => <Provider store={store}>{children}</Provider>;
};

beforeEach(() => {
  vi.useFakeTimers();
  api.isChatFeedbackEnabled.mockReturnValue(true);
  api.submitConversationAnalysis.mockClear();
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
});
