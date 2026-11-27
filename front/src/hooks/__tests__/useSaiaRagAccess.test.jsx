import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetSaiaRagAccessForTests,
  useSaiaRagAccessWithReload,
} from "../useSaiaRagAccess";

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
  resetSaiaRagAccessForTests();
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

  it("asks once for two surfaces that mount together", async () => {
    probe.check.mockReturnValue(new Promise(() => {}));

    render(
      <>
        <AccessProbe label="sidebar" />
        <AccessProbe label="page" />
      </>,
    );

    // Every page mounts its own sidebar; two probes would mean two hops into
    // the registry for one answer.
    expect(probe.check).toHaveBeenCalledTimes(1);
    expect(screen.getByText("sidebar:checking")).toBeInTheDocument();
    expect(screen.getByText("page:checking")).toBeInTheDocument();
  });

  it("keeps a confirmed answer for the next surface and across an unmount", async () => {
    probe.check.mockResolvedValue(true);

    const first = render(<AccessProbe label="first" />);
    expect(await screen.findByText("first:available")).toBeInTheDocument();
    first.unmount();

    // Leaving a page and opening the next one must not pay for the probe again
    // while the answer is still fresh.
    render(<AccessProbe label="second" />);
    expect(screen.getByText("second:available")).toBeInTheDocument();
    expect(probe.check).toHaveBeenCalledTimes(1);
  });

  it("re-asks at once when the service was reported absent", async () => {
    probe.check.mockResolvedValue(false);

    const first = render(<AccessProbe label="first" />);
    expect(await screen.findByText("first:unavailable")).toBeInTheDocument();
    first.unmount();

    // A failure is never kept: the service may have started meanwhile, and the
    // next surface has to find it.
    render(<AccessProbe label="second" />);
    expect(await screen.findByText("second:unavailable")).toBeInTheDocument();
    expect(probe.check).toHaveBeenCalledTimes(2);
  });

  it("ignores an older answer that arrives after a reload", async () => {
    let firstAnswer;
    probe.check.mockReturnValueOnce(
      new Promise((resolve) => {
        firstAnswer = resolve;
      }),
    );
    render(<AccessProbe />);

    probe.check.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "reload-probe" }));
    expect(await screen.findByText("probe:available")).toBeInTheDocument();

    // The abandoned probe must not overwrite the answer the reload produced.
    await act(async () => {
      firstAnswer(false);
    });

    expect(screen.getByText("probe:available")).toBeInTheDocument();
  });
});
