import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSaiaRagAccessWithReload } from "../useSaiaRagAccess";

const probe = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock("../../apis/saiaRag", () => ({
  isSaiaRagAvailable: (...args) => probe.check(...args),
}));

function AccessProbe({ label = "probe" }) {
  const { access, reload } = useSaiaRagAccessWithReload();
  return (
    <div>
      <span>{`${label}:${access}`}</span>
      <button type="button" onClick={reload}>
        {`reload-${label}`}
      </button>
    </div>
  );
}

beforeEach(() => {
  probe.check.mockReset();
});

describe("useSaiaRagAccessWithReload", () => {
  it("starts undecided", () => {
    probe.check.mockReturnValue(new Promise(() => {}));

    render(<AccessProbe />);

    expect(screen.getByText("probe:checking")).toBeInTheDocument();
  });

  it("reports the service when the health probe confirms it", async () => {
    probe.check.mockResolvedValue(true);

    render(<AccessProbe />);

    expect(await screen.findByText("probe:available")).toBeInTheDocument();
  });

  it("reports the service absent when it does not answer", async () => {
    // No route, no instance, a timeout and a refused connection all fold into
    // false, which is the fail-closed answer.
    probe.check.mockResolvedValue(false);

    render(<AccessProbe />);

    expect(await screen.findByText("probe:unavailable")).toBeInTheDocument();
  });

  it("asks again on reload and shows the probe is running meanwhile", async () => {
    probe.check.mockResolvedValueOnce(false);
    render(<AccessProbe />);
    expect(await screen.findByText("probe:unavailable")).toBeInTheDocument();

    let answer;
    probe.check.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "reload-probe" }));

    // Back to undecided, so a second click cannot start a second probe for the
    // same answer.
    expect(screen.getByText("probe:checking")).toBeInTheDocument();
    expect(probe.check).toHaveBeenCalledTimes(2);

    await act(async () => {
      answer(true);
    });

    expect(await screen.findByText("probe:available")).toBeInTheDocument();
  });

  it("reaches every surface that asked when one of them reloads", async () => {
    probe.check.mockResolvedValue(false);
    render(
      <>
        <AccessProbe label="sidebar" />
        <AccessProbe label="page" />
      </>,
    );
    expect(await screen.findByText("sidebar:unavailable")).toBeInTheDocument();
    expect(await screen.findByText("page:unavailable")).toBeInTheDocument();

    // The sidebar must not keep saying "not connected" beside a working page.
    probe.check.mockResolvedValue(true);
    fireEvent.click(screen.getByRole("button", { name: "reload-page" }));

    expect(await screen.findByText("sidebar:available")).toBeInTheDocument();
    expect(await screen.findByText("page:available")).toBeInTheDocument();
  });

  it("aborts the probe when it unmounts", () => {
    probe.check.mockReturnValue(new Promise(() => {}));

    const { unmount } = render(<AccessProbe />);
    const { signal } = probe.check.mock.calls[0][0];

    expect(signal.aborted).toBe(false);
    unmount();

    expect(signal.aborted).toBe(true);
  });
});
