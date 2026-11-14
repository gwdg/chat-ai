import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";

const { mockDb, handlers } = vi.hoisted(() => {
  const handlers = {};
  const mockDb = {
    on: vi.fn((event, callback) => {
      handlers[event] = callback;
    }),
    open: vi.fn(async () => {}),
    close: vi.fn(),
  };
  return { mockDb, handlers };
});

vi.mock("../../../db", () => ({ db: mockDb }));

function namedError(name) {
  const error = new Error(name);
  error.name = name;
  return error;
}

async function renderGate() {
  const { default: DatabaseGate } = await import("../DatabaseGate");
  render(
    <DatabaseGate>
      <span>app content</span>
    </DatabaseGate>,
  );
}

describe("DatabaseGate", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of Object.keys(handlers)) delete handlers[key];
    mockDb.open.mockResolvedValue(undefined);
    mockDb.close.mockClear();
  });

  it("shows a loader until the database opens, then renders the app", async () => {
    let resolveOpen;
    mockDb.open.mockReturnValue(
      new Promise((resolve) => {
        resolveOpen = resolve;
      }),
    );

    await renderGate();

    expect(screen.getByLabelText(i18n.t("common.loading"))).toBeInTheDocument();

    await act(async () => {
      resolveOpen();
    });

    expect(screen.getByText("app content")).toBeInTheDocument();
  });

  it("explains a database blocked by another tab", async () => {
    await renderGate();
    await screen.findByText("app content");

    act(() => handlers.blocked());

    expect(
      screen.getByText(i18n.t("errors.database_blocked")),
    ).toBeInTheDocument();
  });

  it("closes the database and reports a version change in another tab", async () => {
    await renderGate();
    await screen.findByText("app content");

    act(() => handlers.versionchange());

    expect(mockDb.close).toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t("errors.database_version")),
    ).toBeInTheDocument();
  });

  it("maps a quota error when opening the database", async () => {
    mockDb.open.mockRejectedValueOnce(namedError("QuotaExceededError"));

    await renderGate();

    expect(
      await screen.findByText(i18n.t("errors.database_quota")),
    ).toBeInTheDocument();
    expect(screen.queryByText("app content")).not.toBeInTheDocument();
  });

  it("falls back to a generic database error", async () => {
    mockDb.open.mockRejectedValueOnce(namedError("UnknownError"));

    await renderGate();

    expect(
      await screen.findByText(i18n.t("errors.database_generic")),
    ).toBeInTheDocument();
  });
});
