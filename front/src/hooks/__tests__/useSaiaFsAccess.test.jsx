import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSaiaFsAccess } from "../useSaiaFsAccess";

const models = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../apis/getModelsData", () => ({
  getModelsData: (...args) => models.get(...args),
}));

function AccessProbe() {
  return <span>{useSaiaFsAccess()}</span>;
}

beforeEach(() => {
  models.get.mockReset();
});

describe("useSaiaFsAccess", () => {
  it("starts undecided", () => {
    models.get.mockReturnValue(new Promise(() => {}));

    render(<AccessProbe />);

    expect(screen.getByText("checking")).toBeInTheDocument();
  });

  it("grants the filesystem when the user's model list contains saia-fs", async () => {
    models.get.mockResolvedValue([{ id: "qwen3.8-27b" }, { id: "saia-fs" }]);

    render(<AccessProbe />);

    expect(await screen.findByText("granted")).toBeInTheDocument();
  });

  it("denies it when the deployment lists models without saia-fs", async () => {
    // The engine lists a service only for users granted its access group, so a
    // readable list without it means this account has no folder.
    models.get.mockResolvedValue([{ id: "qwen3.8-27b" }, { id: "saia-agent" }]);

    render(<AccessProbe />);

    expect(await screen.findByText("denied")).toBeInTheDocument();
  });

  it("does not provision on an unreadable list", async () => {
    // Unlike the agent service, this fails closed: an empty list or a refused
    // endpoint cannot say the service is available, and the source must stay out.
    models.get.mockResolvedValue([]);

    render(<AccessProbe />);

    expect(await screen.findByText("unknown")).toBeInTheDocument();
  });

  it("does not provision when the models endpoint refuses", async () => {
    models.get.mockResolvedValue(new Response(null, { status: 401 }));

    render(<AccessProbe />);

    expect(await screen.findByText("unknown")).toBeInTheDocument();
  });

  it("settles on unknown when the model request rejects", async () => {
    models.get.mockRejectedValue(new Error("network down"));

    render(<AccessProbe />);

    expect(await screen.findByText("unknown")).toBeInTheDocument();
  });
});
