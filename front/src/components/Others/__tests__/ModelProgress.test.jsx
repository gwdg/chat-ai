import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModelProgress from "../ModelProgress";

describe("ModelProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the task and a live elapsed time while waiting", () => {
    render(<ModelProgress title="Summarizing..." />);

    expect(screen.getByText("Summarizing...")).toBeInTheDocument();
    expect(screen.getByText("0 s")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("3 s")).toBeInTheDocument();
  });

  it("reports the words received so far", () => {
    render(<ModelProgress title="Summarizing..." words={12} dataGuide="x" />);

    expect(screen.getByText(/Received 12 words/)).toBeInTheDocument();
  });

  it("uses the singular for a single word", () => {
    render(<ModelProgress title="Summarizing..." words={1} />);

    expect(screen.getByText(/Received 1 word…/)).toBeInTheDocument();
  });

  it("shows reasoning words until the answer starts", () => {
    render(<ModelProgress title="Analyzing" reasoningWords={7} />);

    expect(screen.getByText(/Model is reasoning — 7 words/)).toBeInTheDocument();
  });

  it("prefers the answer over the reasoning counter", () => {
    render(
      <ModelProgress title="Analyzing" words={4} reasoningWords={70} />,
    );

    expect(screen.getByText(/Received 4 words/)).toBeInTheDocument();
    expect(screen.queryByText(/reasoning/)).not.toBeInTheDocument();
  });

  it("renders an optional description and the guide hook", () => {
    render(
      <ModelProgress
        title="Summarizing..."
        description="Please wait."
        dataGuide="summarize-progress"
      />,
    );

    expect(screen.getByText("Please wait.")).toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="summarize-progress"]'),
    ).toBeTruthy();
  });
});
