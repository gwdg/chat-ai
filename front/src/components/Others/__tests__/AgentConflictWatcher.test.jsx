import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

import AgentConflictWatcher from "../AgentConflictWatcher";
import { AGENT_SERVICE_CONFLICT_EVENT } from "../../../apis/agentService";
import {
  addAgent,
  getAgent,
  removeAgent,
} from "../../../agents/agentStore";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";

const mocks = vi.hoisted(() => ({
  notifyError: vi.fn(),
  deleteServiceAgent: vi.fn(async () => null),
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));

vi.mock("../../../apis/agentService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    deleteServiceAgent: (...args) => mocks.deleteServiceAgent(...args),
  };
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
};

const renderWatcher = (path = "/chat") =>
  render(
    <Provider
      store={configureStore({
        reducer: { interface_settings: interfaceSettingsReducer },
      })}
    >
      <MemoryRouter initialEntries={[path]}>
        <AgentConflictWatcher />
        <LocationProbe />
      </MemoryRouter>
    </Provider>,
  );

const dispatchConflict = (detail) => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(AGENT_SERVICE_CONFLICT_EVENT, { detail }),
    );
  });
};

const addServiceAgent = (id, serviceAgentId, name) => {
  addAgent({
    id,
    name,
    serviceAgentId,
    serverUrl: `http://agent-service:8090/agents/${serviceAgentId}/opencode`,
  });
};

beforeEach(() => {
  mocks.notifyError.mockReset();
  mocks.deleteServiceAgent.mockReset();
  mocks.deleteServiceAgent.mockResolvedValue(null);
  localStorage.clear();
});

afterEach(() => {
  removeAgent("agent-1");
  removeAgent("agent-2");
  removeAgent("agent-3");
});

describe("AgentConflictWatcher", () => {
  it("removes the agent, leaves its page and tells the user", async () => {
    addServiceAgent("agent-1", "service-1", "Worker");
    renderWatcher("/agent/agent-1");

    dispatchConflict({
      serviceAgentId: "service-1",
      code: "conflict",
      status: "failed",
    });

    await waitFor(() => expect(getAgent("agent-1")).toBeUndefined());
    expect(screen.getByTestId("path").textContent).toBe("/chat");
    expect(mocks.deleteServiceAgent).toHaveBeenCalledWith("service-1");
    expect(mocks.notifyError).toHaveBeenCalledWith(
      expect.stringContaining("Agent Worker was removed"),
      { autoClose: 8000 },
    );
  });

  it("stays on an unrelated page", async () => {
    addServiceAgent("agent-2", "service-2", "Researcher");
    renderWatcher("/chat");

    dispatchConflict({
      serviceAgentId: "service-2",
      code: "conflict",
      status: "terminated",
    });

    await waitFor(() => expect(getAgent("agent-2")).toBeUndefined());
    expect(screen.getByTestId("path").textContent).toBe("/chat");
  });

  it("removes an agent once although several requests fail", async () => {
    addServiceAgent("agent-3", "service-3", "Writer");
    renderWatcher("/agent/agent-3");

    dispatchConflict({ serviceAgentId: "service-3", status: "failed" });
    dispatchConflict({ serviceAgentId: "service-3", status: "failed" });
    dispatchConflict({ serviceAgentId: "service-3", status: "failed" });

    await waitFor(() => expect(getAgent("agent-3")).toBeUndefined());
    expect(mocks.deleteServiceAgent).toHaveBeenCalledTimes(1);
    expect(mocks.notifyError).toHaveBeenCalledTimes(1);
  });

  it("keeps a healthy agent that is only starting", () => {
    addServiceAgent("agent-4", "service-4", "Starter");
    renderWatcher("/agent/agent-4");

    dispatchConflict({ serviceAgentId: "service-4", status: "starting" });

    expect(getAgent("agent-4")).toBeDefined();
    expect(mocks.deleteServiceAgent).not.toHaveBeenCalled();
    expect(mocks.notifyError).not.toHaveBeenCalled();
    removeAgent("agent-4");
  });
});
