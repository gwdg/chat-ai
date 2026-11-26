import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

import i18n from "../../../i18n";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";
import BugReportModal from "../BugReportModal";

const store = configureStore({
  reducer: { interface_settings: interfaceSettingsReducer },
});

const renderModal = (props = {}) =>
  render(
    <Provider store={store}>
      <BugReportModal isOpen onClose={vi.fn()} {...props} />
    </Provider>,
  );

const typeDescription = (text) =>
  fireEvent.change(screen.getByPlaceholderText(/what did you do/i), {
    target: { value: text },
  });

const attach = (files) =>
  fireEvent.change(screen.getByLabelText(/screenshots/i, { selector: "input" }), {
    target: { files },
  });

const pngFile = (name = "shot.png") =>
  new File([new Uint8Array(8)], name, { type: "image/png" });

describe("BugReportModal", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.stubEnv("VITE_FEEDBACK_ENDPOINT", "/feedback");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("refuses an empty description without calling the endpoint", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    });

    expect(screen.getByText("Please describe the problem.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a multipart report with the page context", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve("") }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderModal();

    typeDescription("The send button does nothing.");
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "accessibility" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/feedback");
    expect(init.method).toBe("POST");
    // The browser must set the multipart boundary itself.
    expect(init.headers?.Authorization).toBeUndefined();

    const body = init.body;
    expect(body).toBeInstanceOf(FormData);
    const payload = JSON.parse(body.get("payload"));
    expect(payload.type).toBe("accessibility");
    expect(payload.message).toBe("The send button does nothing.");
    expect(payload.context.route).toBe(window.location.pathname + window.location.search);
    expect(payload.context.app_version).toBeTruthy();

    expect(await screen.findByText("Thank you — the report was sent.")).toBeInTheDocument();
  });

  it("files the report under the chat it was filed from", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve("") }),
    );
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/chat/conv-7?message=m2");
    try {
      renderModal();

      typeDescription("This answer was cut off.");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send report" }));
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const payload = JSON.parse(fetchMock.mock.calls[0][1].body.get("payload"));
      expect(payload.conversation_id).toBe("conv-7");
      expect(payload.context.conversation_id).toBe("conv-7");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("offers the assembled text when the deployment has no receiver", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 501 })),
    );
    renderModal();

    typeDescription("Something is off.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    });

    expect(
      await screen.findByText(/there is no feedback receiver|has no feedback receiver/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy report" })).toBeInTheDocument();
  });

  it("rejects an unsupported attachment and too many screenshots", async () => {
    renderModal();

    await act(async () => {
      attach([
        new File([new Uint8Array(8)], "notes.txt", { type: "text/plain" }),
      ]);
    });
    expect(
      screen.getByText("Only PNG, JPEG and WebP images can be attached."),
    ).toBeInTheDocument();

    await act(async () => {
      attach([pngFile("a.png"), pngFile("b.png"), pngFile("c.png"), pngFile("d.png")]);
    });
    expect(
      screen.getByText("You can attach at most 3 screenshots."),
    ).toBeInTheDocument();
  });
});
