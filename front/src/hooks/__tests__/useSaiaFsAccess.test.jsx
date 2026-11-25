import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSaiaFsAccess } from "../useSaiaFsAccess";

const probe = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock("../../apis/saiaFs", () => ({
  isSaiaFsAvailable: (...args) => probe.check(...args),
}));

function AccessProbe() {
  return <span>{useSaiaFsAccess()}</span>;
}

beforeEach(() => {
  probe.check.mockReset();
});

describe("useSaiaFsAccess", () => {
  it("starts undecided", () => {
    probe.check.mockReturnValue(new Promise(() => {}));

    render(<AccessProbe />);

    expect(screen.getByText("checking")).toBeInTheDocument();
  });

  it("grants the filesystem when the health probe confirms it", async () => {
    probe.check.mockResolvedValue(true);

    render(<AccessProbe />);

    expect(await screen.findByText("available")).toBeInTheDocument();
  });

  it("leaves it out when the service does not answer", async () => {
    // The probe folds every failure (no route, no instance, timeout, network)
    // into false, so the source stays out rather than pointing at nothing.
    probe.check.mockResolvedValue(false);

    render(<AccessProbe />);

    expect(await screen.findByText("unavailable")).toBeInTheDocument();
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
