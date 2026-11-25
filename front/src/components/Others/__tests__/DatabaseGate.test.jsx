import { act, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../i18n/en";
import DatabaseGate from "../DatabaseGate";

const { openMock, closeMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  closeMock: vi.fn(),
}));

vi.mock("../../../db", () => ({
  db: { open: openMock, close: closeMock, on: vi.fn() },
}));

const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.init({
    lng: "en",
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  vi.useFakeTimers();
  openMock.mockReset();
  closeMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const renderGate = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <DatabaseGate>
        <div>app is up</div>
      </DatabaseGate>
    </I18nextProvider>,
  );

describe("DatabaseGate", () => {
  it("shows the spinner while the database is opening", () => {
    openMock.mockReturnValue(new Promise(() => {}));
    renderGate();
    expect(screen.getByLabelText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("app is up")).not.toBeInTheDocument();
  });

  it("names the cause and offers a retry when the open never settles", () => {
    openMock.mockReturnValue(new Promise(() => {}));
    renderGate();

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByText("Local database unavailable")).toBeInTheDocument();
    expect(screen.getByText(/close every other Chat AI tab/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText("Your data is safe")).toBeInTheDocument();
  });

  it("retries with a fresh open request instead of the same pending one", () => {
    openMock.mockReturnValue(new Promise(() => {}));
    renderGate();
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    act(() => {
      screen.getByRole("button", { name: "Retry" }).click();
    });

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Loading...")).toBeInTheDocument();
  });

  it("still loads the app when the open succeeds after the warning", async () => {
    let resolveOpen;
    openMock.mockReturnValue(
      new Promise((resolve) => {
        resolveOpen = resolve;
      }),
    );
    renderGate();
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByText("Local database unavailable")).toBeInTheDocument();

    await act(async () => {
      resolveOpen();
    });

    expect(screen.getByText("app is up")).toBeInTheDocument();
  });
});
