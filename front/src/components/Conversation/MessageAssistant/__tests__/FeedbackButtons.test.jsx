import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FeedbackButtons from "../FeedbackButtons";

const renderButtons = (message = {}) => {
  const sendFeedbackFunc = vi.fn();
  const setFeedbackMode = vi.fn();
  const localState = { messages: [{ role: "assistant", content: "Answer", ...message }] };
  const utils = render(
    <FeedbackButtons
      localState={localState}
      message_index={0}
      setFeedbackMode={setFeedbackMode}
      sendFeedbackFunc={sendFeedbackFunc}
    />,
  );
  return { ...utils, sendFeedbackFunc, setFeedbackMode };
};

describe("FeedbackButtons", () => {
  it("rates up and down through the send callback", () => {
    const { container, sendFeedbackFunc } = renderButtons();
    const [up, down] = container.querySelectorAll("button");

    fireEvent.click(up);
    expect(sendFeedbackFunc).toHaveBeenLastCalledWith(1, undefined, undefined);

    fireEvent.click(down);
    expect(sendFeedbackFunc).toHaveBeenLastCalledWith(-1, undefined, undefined);
  });

  it("keeps the comment and answer text when a thumb is clicked", () => {
    const { container, sendFeedbackFunc } = renderButtons({
      feedback: { comment: "Explain more", result: "Answer" },
    });
    fireEvent.click(container.querySelectorAll("button")[0]);
    expect(sendFeedbackFunc).toHaveBeenCalledWith(
      1,
      "Explain more",
      "Answer",
    );
  });

  it("clears an existing rating when the same thumb is clicked again", () => {
    const { container, sendFeedbackFunc } = renderButtons({
      feedback: { rating: 1, result: "Answer" },
    });
    fireEvent.click(container.querySelectorAll("button")[0]);
    expect(sendFeedbackFunc).toHaveBeenCalledWith(undefined, undefined, "Answer");
  });

  it("opens the comment box", () => {
    const { container, setFeedbackMode } = renderButtons();
    fireEvent.click(container.querySelectorAll("button")[2]);
    expect(setFeedbackMode).toHaveBeenCalledWith(true);
  });
});
