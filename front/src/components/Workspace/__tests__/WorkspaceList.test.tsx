import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

const mocks = vi.hoisted(() => ({
  fetchSessions: vi.fn(),
  switchSession: vi.fn(),
  createSession: vi.fn(),
  attach: vi.fn(async () => {}),
  hasAgentLink: vi.fn(async () => true),
  sessionLinks: vi.fn(),
  chatLinks: vi.fn(),
  conversations: vi.fn(),
  notifyError: vi.fn(),
  workspaces: vi.fn(),
  setPinned: vi.fn(async () => {}),
  createChat: vi.fn(async () => "chat-new"),
  detachChat: vi.fn(async () => {}),
  openModal: vi.fn(),
}));

vi.mock("../../../db", () => ({
  useConversationList: () => mocks.conversations(),
}));
vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceList: () => mocks.workspaces(),
  createAttachedChat: (...args: any[]) => mocks.createChat(...args),
  setWorkspacePinned: (...args: any[]) => mocks.setPinned(...args),
  useWorkspaceChatLinks: () => mocks.chatLinks(),
  useWorkspaceAgentLinks: () => [{ workspaceId: "ws-1", agentId: "agent-1" }],
  useWorkspaceAgentSessionLinks: () => mocks.sessionLinks(),
  deleteWorkspace: vi.fn(),
  detachWorkspaceAgent: vi.fn(),
  detachWorkspaceChat: (...args: any[]) => mocks.detachChat(...args),
  attachWorkspaceAgentSession: (...args: any[]) => mocks.attach(...args),
  detachWorkspaceAgentSession: vi.fn(),
  hasWorkspaceAgentLink: (...args: any[]) => mocks.hasAgentLink(...args),
}));
vi.mock("../../../agents/agentStore", () => ({
  useAgents: () => [
    { id: "agent-1", name: "HPC agent", sessionId: "session-1" },
  ],
}));
vi.mock("../../../agents/agentSessions", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchAgentSessions: (...args: any[]) => mocks.fetchSessions(...args),
    createAgentSession: (...args: any[]) => mocks.createSession(...args),
    switchAgentSession: (...args: any[]) => mocks.switchSession(...args),
    sessionSummariesFor: () => ({}),
  };
});
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({
    openModal: mocks.openModal,
    confirmAction: vi.fn(),
  }),
}));
vi.mock("../../../utils/conversationUtils", () => ({
  getDefaultConversation: () => ({
    id: "draft",
    title: "Untitled Chat",
    settings: {},
  }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: mocks.notifyError }),
}));

import WorkspaceList, {
  workspaceRowCollapseId,
} from "../WorkspaceList";
import { workspaceAgentCollapseId } from "../../Sidebar/sessionGroupCollapse";
import {
  CHAT_DRAG_MIME,
  CHAT_SOURCE_WORKSPACE_MIME,
} from "../../Sidebar/chatDrop";
import {
  AGENT_SESSION_DRAG_MIME,
  AGENT_SESSION_SOURCE_WORKSPACE_MIME,
} from "../../Sidebar/sessionDrop";
import { pinnedStateId } from "../../Sidebar/pinnedState";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";

const session = (id: string, title: string) => ({ id, title });

const makeStore = () =>
  configureStore({ reducer: { interface_settings: interfaceSettingsReducer } });

const renderList = (
  store: ReturnType<typeof makeStore>,
  initialEntries: string[] = ["/"],
  variant: "all" | "pinned" = "all",
  props: Partial<ComponentProps<typeof WorkspaceList>> = {},
) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        <WorkspaceList variant={variant} {...props} />
      </MemoryRouter>
    </Provider>,
  );

beforeEach(() => {
  mocks.fetchSessions.mockReset().mockResolvedValue({
    roots: [session("session-1", "Design session")],
    all: [
      session("session-1", "Design session"),
      session("session-2", "Session of another workspace"),
    ],
    children: new Map(),
  });
  mocks.switchSession.mockReset();
  mocks.createSession.mockReset();
  mocks.attach.mockReset();
  mocks.hasAgentLink.mockReset().mockResolvedValue(true);
  mocks.sessionLinks.mockReset().mockReturnValue([
    { workspaceId: "ws-1", agentId: "agent-1", sessionId: "session-1" },
  ]);
  mocks.chatLinks.mockReset().mockReturnValue([]);
  mocks.conversations.mockReset().mockReturnValue([]);
  mocks.workspaces.mockReset().mockReturnValue([
    { id: "ws-1", name: "Teaching", icon: "default", color: "violet" },
  ]);
  mocks.setPinned.mockReset();
  mocks.createChat.mockReset().mockResolvedValue("chat-new");
  mocks.detachChat.mockReset();
  mocks.openModal.mockReset();
});

const LocationProbe = () => {
  const location = useLocation();
  return (
    <span data-testid="location" data-state={JSON.stringify(location.state)}>
      {location.pathname}
    </span>
  );
};

const asksForRightPanel = () =>
  expect(screen.getByTestId("location")).toHaveAttribute(
    "data-state",
    expect.stringContaining('"openWorkspacePanel":true'),
  );

describe("WorkspaceList band shape", () => {
  it("shows the chat count between the name and the row controls", async () => {
    mocks.conversations.mockReturnValue([
      { id: "chat-1", title: "Workspace chat", lastModified: 1 },
      { id: "chat-2", title: "Second chat", lastModified: 1 },
    ]);
    mocks.chatLinks.mockReturnValue([
      { workspaceId: "ws-1", conversationId: "chat-1" },
      { workspaceId: "ws-1", conversationId: "chat-2" },
    ]);
    renderList(makeStore());

    const row = (await screen.findByText("Teaching")).closest(
      '[data-guide="workspace-row"]',
    ) as HTMLElement;
    const kids = [...row.children];
    const count = kids.find(
      (el) => el.textContent?.trim() === "2",
    ) as HTMLElement;
    expect(count).toBeTruthy();
    expect(count.className).toContain("text-[11px]");
    expect(count.className).toContain("tabular-nums");
    const addIndex = kids.findIndex(
      (el) => el.getAttribute("aria-label") === "New chat in this workspace",
    );
    const menuIndex = kids.findIndex((el) =>
      el.querySelector('[aria-label="Workspace options"]'),
    );
    expect(kids.indexOf(count)).toBeLessThan(addIndex);
    expect(addIndex).toBeLessThan(menuIndex);
  });

  it("uses the same band box and icon slot as a topic row", async () => {
    renderList(makeStore());

    const row = (await screen.findByText("Teaching")).closest(
      '[data-guide="workspace-row"]',
    ) as HTMLElement;
    // The chevron leads; the name button and its tile follow.
    const toggle = row.children[0] as HTMLElement;
    const label = row.children[1] as HTMLElement;
    expect(toggle.getAttribute("aria-label")).toBe(
      "Attached chats, agents and sessions",
    );
    expect(row.className).toContain("min-h-9");
    expect(row.className).toContain("px-1");
    // The whole band offers the pointer, exactly like a topic band.
    expect(row.className).toContain("cursor-pointer");
    expect(label.className).toContain("self-stretch");
    expect(label.className).not.toContain("py-1.5");
    expect((label.firstElementChild as HTMLElement).className).toContain(
      "h-6 w-6",
    );
  });

  it("draws no rule between a workspace's chats and its agents", async () => {
    mocks.conversations.mockReturnValue([
      { id: "chat-1", title: "Workspace chat", lastModified: 1 },
    ]);
    mocks.chatLinks.mockReturnValue([
      { workspaceId: "ws-1", conversationId: "chat-1" },
    ]);
    renderList(makeStore());

    const row = (await screen.findByText("Teaching")).closest(
      '[data-guide="workspace-row"]',
    ) as HTMLElement;
    expect(screen.getByText("Workspace chat")).toBeInTheDocument();
    expect(screen.getByText("HPC agent")).toBeInTheDocument();
    const subtree = row.nextElementSibling as HTMLElement;
    expect(subtree.querySelector(".border-t")).toBeNull();
  });

  it("draws the workspace icon as a bare glyph, the way a topic does", async () => {
    renderList(makeStore());

    const row = (await screen.findByText("Teaching")).closest(
      '[data-guide="workspace-row"]',
    ) as HTMLElement;
    const tile = row.querySelector("span.h-6.w-6") as HTMLElement;
    // The row already carries the workspace colour: the icon adds no box of its own.
    expect(tile.getAttribute("style") ?? "").not.toContain("background");
    expect(tile.className).not.toContain("rounded-md");
    expect(tile.querySelector("svg")).not.toBeNull();
  });
});

describe("WorkspaceList pinning", () => {
  it("pins a workspace from its options menu", async () => {
    renderList(makeStore());

    fireEvent.click(
      await screen.findByRole("button", { name: "Workspace options" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Pin Workspace" }));

    await waitFor(() =>
      expect(mocks.setPinned).toHaveBeenCalledWith("ws-1", true),
    );
  });

  it("keeps a pinned workspace in the Workspace section", async () => {
    mocks.workspaces.mockReturnValue([
      {
        id: "ws-1",
        name: "Teaching",
        icon: "default",
        color: "violet",
        pinned: true,
      },
    ]);
    renderList(makeStore());

    expect(await screen.findByText("Teaching")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Workspace options" }),
    ).toBeInTheDocument();
  });

  it("renders only pinned workspaces in the pinned variant", async () => {
    mocks.workspaces.mockReturnValue([
      {
        id: "ws-1",
        name: "Teaching",
        icon: "default",
        color: "violet",
        pinned: true,
      },
      {
        id: "ws-2",
        name: "Scratch",
        icon: "default",
        color: "violet",
        pinned: false,
      },
    ]);
    renderList(makeStore(), ["/"], "pinned");

    expect(await screen.findByText("Teaching")).toBeInTheDocument();
    expect(screen.queryByText("Scratch")).not.toBeInTheDocument();
    // The pinned variant drops the section band and its create button.
    expect(
      screen.queryByRole("button", { name: "New workspace" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the whole subtree of a pinned workspace in the pinned variant", async () => {
    mocks.workspaces.mockReturnValue([
      {
        id: "ws-1",
        name: "Teaching",
        icon: "default",
        color: "violet",
        pinned: true,
      },
    ]);
    mocks.conversations.mockReturnValue([
      { id: "chat-1", title: "Workspace chat" },
    ]);
    mocks.chatLinks.mockReturnValue([
      { workspaceId: "ws-1", conversationId: "chat-1" },
    ]);
    renderList(makeStore(), ["/"], "pinned");

    expect(await screen.findByText("Teaching")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Workspace chat" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("HPC agent")).toBeInTheDocument();
    expect(await screen.findByText("Design session")).toBeInTheDocument();
  });

  it("folds the pinned copy without folding the workspace in its own section", async () => {
    const store = makeStore();
    mocks.workspaces.mockReturnValue([
      {
        id: "ws-1",
        name: "Teaching",
        icon: "default",
        color: "violet",
        pinned: true,
      },
    ]);
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/"]}>
          <WorkspaceList variant="pinned" />
          <WorkspaceList />
        </MemoryRouter>
      </Provider>,
    );

    const toggles = await screen.findAllByRole("button", {
      name: "Attached chats, agents and sessions",
    });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "true");
    expect(toggles[1]).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggles[0]);

    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    expect(toggles[1]).toHaveAttribute("aria-expanded", "true");
    expect(store.getState().interface_settings.collapsed_topics).toContain(
      pinnedStateId(workspaceRowCollapseId("ws-1")),
    );
    expect(store.getState().interface_settings.collapsed_topics).not.toContain(
      workspaceRowCollapseId("ws-1"),
    );
  });
});

describe("WorkspaceList manage", () => {
  it("offers Pin, Manage, Attach and Delete, in that order", async () => {
    renderList(makeStore());

    fireEvent.click(
      await screen.findByRole("button", { name: "Workspace options" }),
    );
    // The pin leads the menu and the destructive entry stays last.
    const labels = [
      "Pin Workspace",
      "Manage Workspace",
      "Attach Agent Session",
      "Delete Workspace",
    ];
    const panel = screen.getByRole("button", { name: labels[0] }).parentElement;
    const inMenuOrder = [...(panel?.querySelectorAll("button") ?? [])].map(
      (item) => item.textContent?.trim(),
    );
    expect(inMenuOrder).toEqual(labels);
  });

  it("opens the workspace editor — name, icon, colour and storage — from its options menu", async () => {
    renderList(makeStore());

    fireEvent.click(
      await screen.findByRole("button", { name: "Workspace options" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Manage Workspace" }));

    expect(mocks.openModal).toHaveBeenCalledWith("workspaceEdit", {
      workspaceId: "ws-1",
    });
    // One entry instead of two: the old storage-only and rename-only dialogs are gone.
    expect(
      screen.queryByRole("button", { name: "Edit storage" }),
    ).not.toBeInTheDocument();
  });
});

describe("WorkspaceList agent sessions", () => {
  it("shows only the sessions attached to the workspace", async () => {
    const store = makeStore();
    renderList(store);

    expect(await screen.findByText("Design session")).toBeInTheDocument();
    expect(
      screen.queryByText("Session of another workspace"),
    ).not.toBeInTheDocument();
  });

  it("collapses and expands the sessions of one agent", async () => {
    const store = makeStore();
    renderList(store);

    expect(await screen.findByText("Design session")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Sessions" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(screen.queryByText("Design session")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(await screen.findByText("Design session")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("remembers a collapsed agent row after a remount", async () => {
    const store = makeStore();
    const first = renderList(store);

    expect(await screen.findByText("Design session")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    expect(
      store.getState().interface_settings.collapsed_topics,
    ).toContain(workspaceAgentCollapseId("ws-1", "agent-1"));

    first.unmount();
    renderList(store);

    await screen.findByText("HPC agent");
    expect(screen.queryByText("Design session")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sessions" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("remembers a collapsed workspace row after a remount", async () => {
    const store = makeStore();
    const first = renderList(store);

    await screen.findByText("HPC agent");
    fireEvent.click(
      screen.getByRole("button", { name: "Attached chats, agents and sessions" }),
    );
    expect(
      store.getState().interface_settings.collapsed_topics,
    ).toContain(workspaceRowCollapseId("ws-1"));
    expect(screen.queryByText("HPC agent")).not.toBeInTheDocument();

    first.unmount();
    renderList(store);

    expect(await screen.findByText("Teaching")).toBeInTheDocument();
    expect(screen.queryByText("HPC agent")).not.toBeInTheDocument();
  });

  it("keeps the toggle of an agent without sessions disabled", async () => {
    mocks.sessionLinks.mockReturnValue([]);
    const store = makeStore();
    renderList(store);

    await screen.findByText("HPC agent");
    expect(screen.getByRole("button", { name: "Sessions" })).toBeDisabled();
  });

  it("opens an attached session in the agent view", async () => {
    const store = makeStore();
    renderList(store);

    fireEvent.click(await screen.findByText("Design session"));

    await waitFor(() =>
      expect(mocks.switchSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent-1" }),
        "session-1",
      ),
    );
  });

  it("creates a new session inside the workspace", async () => {
    mocks.createSession.mockResolvedValue({ id: "session-3" });
    const store = makeStore();
    renderList(store);

    await screen.findByText("Design session");
    const addButtons = screen.getAllByTitle("New session");
    // The agent's own plus button, not the workspace-level one.
    fireEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() =>
      expect(mocks.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: "agent-1" }),
      ),
    );
    await waitFor(() =>
      expect(mocks.attach).toHaveBeenCalledWith(
        "ws-1",
        "agent-1",
        "session-3",
      ),
    );
  });

  it("highlights the open chat and no agent session", async () => {
    mocks.conversations.mockReturnValue([
      { id: "chat-1", title: "Workspace chat" },
    ]);
    mocks.chatLinks.mockReturnValue([
      { workspaceId: "ws-1", conversationId: "chat-1" },
    ]);
    renderList(makeStore(), ["/chat/chat-1"]);

    const chat = await screen.findByRole("button", { name: "Workspace chat" });
    expect(chat).toHaveAttribute("aria-current", "page");
    const session = await screen.findByText("Design session");
    expect(session.closest("button")).not.toHaveAttribute("aria-current");
    expect(
      screen.getByText("HPC agent").closest("button"),
    ).not.toHaveAttribute("aria-current");
  });

  it("highlights the open agent and its session", async () => {
    renderList(makeStore(), ["/agent/agent-1"]);

    const session = await screen.findByText("Design session");
    expect(session.closest("button")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("HPC agent").closest("button")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("WorkspaceList new chats", () => {
  it("starts a workspace chat from the + of the row", async () => {
    renderList(makeStore());

    fireEvent.click(
      await screen.findByRole("button", {
        name: "New chat in this workspace",
      }),
    );

    await waitFor(() =>
      expect(mocks.createChat).toHaveBeenCalledWith(
        "ws-1",
        expect.objectContaining({ title: "Untitled Chat" }),
      ),
    );
  });
});

describe("WorkspaceList chat rows", () => {
  beforeEach(() => {
    mocks.conversations.mockReturnValue([
      { id: "chat-1", title: "Workspace chat" },
    ]);
    mocks.chatLinks.mockReturnValue([
      { workspaceId: "ws-1", conversationId: "chat-1" },
    ]);
  });

  it("uses the topic chat row chrome when the chat is active", async () => {
    renderList(makeStore(), ["/chat/chat-1"]);

    const chat = await screen.findByRole("button", { name: "Workspace chat" });
    const row = chat.parentElement as HTMLElement;
    // Selected chats wear the group's own colour edge to edge between its two
    // rules, not a smaller grey rounded rectangle.
    expect(row.className).toContain("-mx-2");
    expect(row.className).toContain("bg-[var(--chat-tint)]");
    expect(row.className).not.toContain("bg-base-200");
    expect(row.className).not.toContain("rounded-xl");
    expect(row.style.getPropertyValue("--chat-tint")).toContain("rgba(");
    expect(row.className).toContain("px-2");
    expect(row.className).toContain("py-1");
    expect(row.className).toContain("border");
    expect(row.className).toContain("border-transparent");
    expect(row.className).not.toContain("rounded-md");

    // The cursor over the title is the same one a topic chat shows.
    expect(chat.style.cursor).not.toBe("");
    expect(chat.style.cursor).toBe(
      window.innerWidth >= 1280 ? "text" : "pointer",
    );
    expect(chat.className).toContain("text-xs");
    expect(chat.className).toContain("leading-relaxed");
    expect(chat.className).not.toContain("text-[11px]");

    const detach = screen.getByRole("button", { name: "Detach chat" });
    expect(detach.className).toContain("h-7");
    expect(detach.className).toContain("w-7");
    expect(detach.className).toContain("rounded-lg");
    expect(detach.className).toContain("hover:bg-base-300");
    expect(detach.className).toContain("transition-all");
    expect(detach.className).toContain("duration-200");
  });

  it("indents its chat list exactly like a topic's", async () => {
    renderList(makeStore());

    const chat = await screen.findByRole("button", { name: "Workspace chat" });
    const list = chat.closest('[data-guide="workspace-chat-row"]')
      ?.parentElement as HTMLElement;
    // The topic list under a topic is `ml-2 … gap-1 border-x-2 px-2`; the
    // workspace list used to sit at `ml-8` with `gap-0.5`, which made every
    // row 24 pixels narrower.
    expect(list.className).toContain("ml-2");
    expect(list.className).toContain("mr-1");
    expect(list.className).toContain("gap-1");
    expect(list.className).not.toContain("border-x-2");
    expect(list.className).toContain("px-2");
    expect(list.className).not.toContain("ml-8");
    expect(list.className).not.toContain("gap-0.5");

    const section = document.querySelector(
      '[data-guide="workspace-list"]',
    ) as HTMLElement;
    expect(section.className).toContain("pl-3");
    expect(section.className).toContain("pr-2");
  });

  it("keeps chat navigation and detach working", async () => {
    render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={["/"]}>
          <WorkspaceList />
          <LocationProbe />
        </MemoryRouter>
      </Provider>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Workspace chat" }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/chat/chat-1");
    asksForRightPanel();

    fireEvent.click(screen.getByRole("button", { name: "Detach chat" }));
    await waitFor(() =>
      expect(mocks.detachChat).toHaveBeenCalledWith("ws-1", "chat-1"),
    );
  });
});

describe("WorkspaceList group colours", () => {
  const rowFor = () =>
    screen.getByText("Teaching").closest("[style]") as HTMLElement;
  const rulesFor = () =>
    screen.getByText("HPC agent").closest('[data-guide="workspace-chats"]') as HTMLElement;

  it("washes the workspace name in its colour and brackets its chats on both sides", async () => {
    renderList(makeStore());

    await screen.findByText("Teaching");
    const row = rowFor();
    // #7C3AED: 6% behind the name in light mode.
    expect(row.style.getPropertyValue("--group-tint")).toBe(
      "rgba(124, 58, 237, 0.06)",
    );
    expect(row.style.getPropertyValue("--group-tint-hover")).toBe(
      "rgba(124, 58, 237, 0.09)",
    );
    // The name row carries no vertical rules; only the rows below are bracketed.
    expect(row.className).not.toContain("border-l-2");
    expect(row.className).not.toContain("border-r-2");

    const rules = rulesFor();
    // Bracketed left and right by a rule that fades down the list.
    const strips = [
      ...rules.querySelectorAll('[data-guide="group-rule"]'),
    ] as HTMLElement[];
    expect(strips.map((strip) => strip.dataset.side)).toEqual([
      "left",
      "right",
    ]);
    for (const strip of strips) {
      expect(strip.style.background).toContain("linear-gradient");
      expect(strip.style.background).toContain("rgba(124, 58, 237, 0.35)");
    }
  });

  it("marks the open workspace with a stronger wash and an accent name", async () => {
    renderList(makeStore(), ["/workspace/ws-1"]);

    await screen.findByText("Teaching");
    const row = rowFor();
    expect(row.style.getPropertyValue("--group-tint")).toBe(
      "rgba(124, 58, 237, 0.16)",
    );
    expect(row.className).toContain("text-accent");
  });
});

describe("WorkspaceList chat drag & drop", () => {
  // jsdom has no working DataTransfer, so the rows get a small stand-in with
  // the three members the drag helpers use.
  const makeDataTransfer = (entries: Record<string, string> = {}) => {
    const data = new Map(Object.entries(entries));
    return {
      get types() {
        return [...data.keys()];
      },
      getData: (type: string) => data.get(type) ?? "",
      setData: (type: string, value: string) => {
        data.set(type, value);
      },
      effectAllowed: "none",
      dropEffect: "none",
    } as unknown as DataTransfer;
  };
  const workspaceRow = async () =>
    (await screen.findByText("Teaching")).closest(
      '[data-guide="workspace-row"]',
    ) as HTMLElement;

  beforeEach(() => {
    mocks.conversations.mockReturnValue([
      { id: "chat-1", title: "Workspace chat" },
    ]);
    mocks.chatLinks.mockReturnValue([
      { workspaceId: "ws-1", conversationId: "chat-1" },
    ]);
  });

  it("attaches a chat dropped on a workspace row", async () => {
    const onChatDrop = vi.fn();
    renderList(makeStore(), ["/"], "all", { onChatDrop });

    const row = await workspaceRow();
    const dataTransfer = makeDataTransfer({ [CHAT_DRAG_MIME]: "chat-9" });

    fireEvent.dragOver(row, { dataTransfer });
    fireEvent.drop(row, { dataTransfer });

    expect(onChatDrop).toHaveBeenCalledWith({
      conversationId: "chat-9",
      targetWorkspaceId: "ws-1",
      sourceWorkspaceId: null,
    });
  });

  it("passes the source workspace of a chat dragged out of another workspace", async () => {
    const onChatDrop = vi.fn();
    renderList(makeStore(), ["/"], "all", { onChatDrop });

    const row = await workspaceRow();
    const dataTransfer = makeDataTransfer({
      [CHAT_DRAG_MIME]: "chat-9",
      [CHAT_SOURCE_WORKSPACE_MIME]: "ws-2",
    });

    fireEvent.drop(row, { dataTransfer });

    expect(onChatDrop).toHaveBeenCalledWith({
      conversationId: "chat-9",
      targetWorkspaceId: "ws-1",
      sourceWorkspaceId: "ws-2",
    });
  });

  it("marks the row under a dragged chat and clears the mark on drop", async () => {
    const onChatDrop = vi.fn();
    renderList(makeStore(), ["/"], "all", { onChatDrop });

    const row = await workspaceRow();
    const dataTransfer = makeDataTransfer({ [CHAT_DRAG_MIME]: "chat-9" });

    fireEvent.dragOver(row, { dataTransfer });
    expect(row.className).toContain("ring-2");

    fireEvent.drop(row, { dataTransfer });
    expect(row.className).not.toContain("ring-2");
  });

  it("ignores drags that are not chats", async () => {
    const onChatDrop = vi.fn();
    renderList(makeStore(), ["/"], "all", { onChatDrop });

    const row = await workspaceRow();
    const dataTransfer = makeDataTransfer({ Files: "" });

    fireEvent.dragOver(row, { dataTransfer });
    fireEvent.drop(row, { dataTransfer });

    expect(onChatDrop).not.toHaveBeenCalled();
    expect(row.className).not.toContain("ring-2");
  });

  it("starts a drag from a workspace chat row with its workspace id", async () => {
    const onChatDragStart = vi.fn();
    const onChatDragEnd = vi.fn();
    renderList(makeStore(), ["/"], "all", {
      onChatDragStart,
      onChatDragEnd,
    });

    const chat = await screen.findByRole("button", { name: "Workspace chat" });
    const row = chat.parentElement as HTMLElement;
    expect(row).toHaveAttribute("draggable", "true");

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(row, { dataTransfer });

    expect(onChatDragStart).toHaveBeenCalledWith("chat-1", "ws-1");
    expect(dataTransfer.getData(CHAT_DRAG_MIME)).toBe("chat-1");
    expect(dataTransfer.getData(CHAT_SOURCE_WORKSPACE_MIME)).toBe("ws-1");
    expect(dataTransfer.effectAllowed).toBe("move");

    fireEvent.dragEnd(row);
    expect(onChatDragEnd).toHaveBeenCalled();
  });

  it("marks the workspace chat row that is being dragged", async () => {
    renderList(makeStore(), ["/"], "all", { draggingConversationId: "chat-1" });

    const chat = await screen.findByRole("button", { name: "Workspace chat" });
    const row = chat.parentElement as HTMLElement;
    expect(row.className).toContain("border-accent/60");
  });
});

describe("WorkspaceList section header", () => {
  it("mirrors the Chats header: chevron, icon, name, count", () => {
    renderList(makeStore());

    const toggle = screen.getByRole("button", { name: /^Workspaces/ });
    expect(toggle).toHaveTextContent("Workspaces");
    const icons = toggle.querySelectorAll("svg");
    // Same order as the Chats header: the collapse chevron leads, the section
    // icon follows.
    expect(icons).toHaveLength(2);
    expect(icons[0].getAttribute("class")).toContain("transition-transform");
    expect(icons[1].getAttribute("class")).not.toContain("transition-transform");

    // The count sits before the add action, so the band never reads "+ 1".
    const band = toggle.parentElement as HTMLElement;
    const add = screen.getByRole("button", { name: "New workspace" });
    const count = add.previousElementSibling as HTMLElement;
    expect(count).toHaveTextContent("1");
    expect(count.className).toContain("tabular-nums");
    expect(count.nextElementSibling).toBe(add);
    expect(band.lastElementChild).toBe(add);
  });

  it("stretches the section band to the sidebar's edges", () => {
    const { container } = renderList(makeStore());

    const band = container.querySelector(
      '[data-guide="workspace-list"] > div',
    ) as HTMLElement;
    // It cancels the section's inset (pl-3 pr-2), leaving the same margin as
    // the Chats band: 4px on both sides.
    expect(band.className).toContain("-ml-2");
    expect(band.className).toContain("-mr-1");
    expect(band.className).toContain("px-3");
    expect(band.className).toContain("rounded-lg");
  });
});

describe("WorkspaceList row controls", () => {
  it("puts the disclosure arrow at the leading edge of the row", async () => {
    renderList(makeStore());

    await screen.findByText("Teaching");
    const row = screen.getByText("Teaching").closest("[style]") as HTMLElement;
    const toggle = screen.getByRole("button", {
      name: "Attached chats, agents and sessions",
    });

    // The chevron opens the row, like the Workspaces and Chats bands.
    expect(row.firstElementChild).toBe(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // It keeps the bands' 4px rhythm before the icon tile.
    expect(toggle.className).toContain("mr-1");
    expect(toggle.className).toContain("cursor-pointer");
    // The name button follows it and owns the navigation click.
    expect(toggle.nextElementSibling?.tagName).toBe("BUTTON");
    expect(row.lastElementChild?.tagName).toBe("DIV");
  });
});

describe("WorkspaceList agent session drag & drop", () => {
  // jsdom has no working DataTransfer; the handlers only read these members.
  const makeDataTransfer = (entries: Record<string, string> = {}) => {
    const data = new Map(Object.entries(entries));
    return {
      get types() {
        return [...data.keys()];
      },
      getData: (type: string) => data.get(type) ?? "",
      setData: (type: string, value: string) => {
        data.set(type, value);
      },
      effectAllowed: "none",
      dropEffect: "none",
    } as unknown as DataTransfer;
  };
  const workspaceRow = async () =>
    (await screen.findByText("Teaching")).closest(
      '[data-guide="workspace-row"]',
    ) as HTMLElement;
  const sessionPayload = JSON.stringify({
    agentId: "agent-1",
    sessionId: "session-2",
  });

  it("attaches an agent session dropped on a workspace row", async () => {
    const onSessionDrop = vi.fn();
    renderList(makeStore(), ["/"], "all", { onSessionDrop });

    const row = await workspaceRow();
    const dataTransfer = makeDataTransfer({
      [AGENT_SESSION_DRAG_MIME]: sessionPayload,
    });

    fireEvent.dragOver(row, { dataTransfer });
    expect(row.className).toContain("ring-2");

    fireEvent.drop(row, { dataTransfer });

    expect(onSessionDrop).toHaveBeenCalledWith({
      agentId: "agent-1",
      sessionId: "session-2",
      targetWorkspaceId: "ws-1",
      sourceWorkspaceId: null,
    });
    expect(row.className).not.toContain("ring-2");
  });

  it("passes the workspace a session was dragged out of", async () => {
    const onSessionDrop = vi.fn();
    renderList(makeStore(), ["/"], "all", { onSessionDrop });

    const row = await workspaceRow();
    const dataTransfer = makeDataTransfer({
      [AGENT_SESSION_DRAG_MIME]: sessionPayload,
      [AGENT_SESSION_SOURCE_WORKSPACE_MIME]: "ws-2",
    });

    fireEvent.drop(row, { dataTransfer });

    expect(onSessionDrop).toHaveBeenCalledWith({
      agentId: "agent-1",
      sessionId: "session-2",
      targetWorkspaceId: "ws-1",
      sourceWorkspaceId: "ws-2",
    });
  });

  it("drags a session row with the workspace it is shown in", async () => {
    renderList(makeStore());

    const session = await screen.findByText("Design session");
    const row = session.closest("[draggable]") as HTMLElement;
    expect(row).toHaveAttribute("draggable", "true");

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(row, { dataTransfer });

    expect(JSON.parse(dataTransfer.getData(AGENT_SESSION_DRAG_MIME))).toEqual({
      agentId: "agent-1",
      sessionId: "session-1",
    });
    expect(dataTransfer.getData(AGENT_SESSION_SOURCE_WORKSPACE_MIME)).toBe(
      "ws-1",
    );
  });
});

describe("WorkspaceList double click", () => {
  const renderWithLocation = (store: ReturnType<typeof makeStore>) =>
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/"]}>
          <WorkspaceList />
          <LocationProbe />
        </MemoryRouter>
      </Provider>,
    );

  it("folds a workspace from a double click instead of opening it", async () => {
    const store = makeStore();
    renderWithLocation(store);

    const name = await screen.findByText("Teaching");
    vi.useFakeTimers();
    try {
      const button = name.closest("button") as HTMLElement;
      fireEvent.click(button, { detail: 1 });
      fireEvent.click(button, { detail: 2 });
      fireEvent.doubleClick(button);
      act(() => vi.advanceTimersByTime(400));

      expect(store.getState().interface_settings.collapsed_topics).toContain(
        workspaceRowCollapseId("ws-1"),
      );
      expect(screen.getByTestId("location")).toHaveTextContent("/");
      expect(
        screen.getByRole("button", {
          name: "Attached chats, agents and sessions",
        }),
      ).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a workspace after a single click once no second click follows", async () => {
    const store = makeStore();
    renderWithLocation(store);

    const name = await screen.findByText("Teaching");
    vi.useFakeTimers();
    try {
      fireEvent.click(name.closest("button") as HTMLElement, { detail: 1 });
      expect(screen.getByTestId("location")).toHaveTextContent("/");

      act(() => vi.advanceTimersByTime(400));
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspace/ws-1",
      );
      asksForRightPanel();
    } finally {
      vi.useRealTimers();
    }
  });
});
