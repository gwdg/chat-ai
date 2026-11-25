import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentServiceAccess } from "../useAgentServiceAccess";

const models = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../apis/getModelsData", () => ({
  getModelsData: (...args) => models.get(...args),
}));

function AccessProbe() {
  return <span>{useAgentServiceAccess()}</span>;
}

beforeEach(() => {
  models.get.mockReset();
});

describe("useAgentServiceAccess", () => {
  it("starts undecided, not denied", () => {
    models.get.mockReturnValue(new Promise(() => {}));

    render(<AccessProbe />);

    expect(screen.getByText("checking")).toBeInTheDocument();
  });

  it("grants the service when the user's model list contains saia-agent", async () => {
    models.get.mockResolvedValue([{ id: "qwen3.8-27b" }, { id: "saia-agent" }]);

    render(<AccessProbe />);

    expect(await screen.findByText("granted")).toBeInTheDocument();
  });

  it("denies it when the deployment lists models without saia-agent", async () => {
    // The engine lists a model only for the users granted its access group, so
    // a readable list without the model is an entitlement answer.
    models.get.mockResolvedValue([{ id: "qwen3.8-27b" }]);

    render(<AccessProbe />);

    expect(await screen.findByText("denied")).toBeInTheDocument();
  });

  it("does not read a failed model list as a denial", async () => {
    // `getModelsData` answers with [] when the request failed entirely. That
    // says nothing about the user's grants, so access stays unknown.
    models.get.mockResolvedValue([]);

    render(<AccessProbe />);

    expect(await screen.findByText("unknown")).toBeInTheDocument();
  });

  it("does not read a refused models endpoint as a denial", async () => {
    // A non-2xx answer is returned as a Response instead of a model array.
    models.get.mockResolvedValue(new Response(null, { status: 401 }));

    render(<AccessProbe />);

    expect(await screen.findByText("unknown")).toBeInTheDocument();
  });

  it("settles on unknown when the model request rejects", async () => {
    // Leaving the dialog on `checking` would lock it forever.
    models.get.mockRejectedValue(new Error("network down"));

    render(<AccessProbe />);

    expect(await screen.findByText("unknown")).toBeInTheDocument();
  });
});
