import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SpeakButton from "../SpeakButton";

const message = {
  role: "assistant",
  content: [{ type: "text", text: "**Hello** from the assistant" }],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SpeakButton", () => {
  it("is hidden when the speech module is off", () => {
    vi.stubEnv("VITE_MODULE_SPEECH", "false");
    render(<SpeakButton message={message} />);
    expect(screen.queryByTitle("Speak")).toBeNull();
  });

  it("speaks with the browser when no TTS model is configured", async () => {
    vi.stubEnv("VITE_MODULE_SPEECH", "true");
    const speak = vi.fn((utterance) => utterance.onend?.());
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), getVoices: () => [], speak });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(text) {
          this.text = text;
        }
      }
    );

    render(<SpeakButton message={message} />);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Speak"));
    });

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toBe("Hello from the assistant");
  });
});
