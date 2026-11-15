import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicList, { PINNED_COLLAPSE_ID, UNSORTED_TOPIC_ID } from "../TopicList";
import {
  collapseTopics,
  expandTopics,
  toggleTopic,
} from "../../../Redux/reducers/interfaceSettingsSlice";

const reduxMocks = vi.hoisted(() => ({
  collapsed: [],
  pathname: "/",
  dispatch: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => reduxMocks.dispatch,
  useSelector: () => reduxMocks.collapsed,
}));
vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: reduxMocks.pathname }),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));

const renderConversationRow = (conv, options = {}) => (
  <div
    data-testid={`conv-${conv.id}`}
    data-leading-dash={options.leadingDash === true ? "true" : "false"}
  >
    {conv.title}
  </div>
);

const baseProps = {
  topics: [],
  pinnedTopics: [],
  pinnedConversations: [],
  conversationsByTopic: new Map(),
  unsortedConversations: [],
  sizeConversations: [],
  onCreateTopic: vi.fn(),
  onRenameTopic: vi.fn(),
  onDeleteTopic: vi.fn(),
  onToggleTopicPinned: vi.fn(),
  onOpenTopic: vi.fn(),
  draggingConversationId: null,
  dragOverTopicId: null,
  onDragEnterTopic: vi.fn(),
  onDragLeaveTopic: vi.fn(),
  onDropTopic: vi.fn(),
  renderConversationRow,
  dateGroups: [],
  creationDateGroups: [],
  isDark: false,
  grouping: "topic",
};

const pinnedChat = { id: "c1", title: "Pinned chat", lastModified: 1 };
const pinnedTopic = { id: "t1", name: "Pinned topic", color: "#B4388D" };

beforeEach(() => {
  reduxMocks.collapsed = [];
  reduxMocks.pathname = "/";
  reduxMocks.dispatch.mockClear();
});

describe("TopicList pinned variant", () => {
  it("renders only the pinned topics and chats", () => {
    render(
      <TopicList
        {...baseProps}
        variant="pinned"
        topics={[{ id: "t9", name: "Other topic", color: "violet" }]}
        pinnedTopics={[pinnedTopic]}
        pinnedConversations={[pinnedChat]}
      />,
    );

    expect(screen.getByTestId("conv-c1")).toBeInTheDocument();
    expect(screen.getByText("Pinned topic")).toBeInTheDocument();
    expect(screen.queryByText("Other topic")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="pinned-items"]'),
    ).not.toBeNull();
  });

  it("marks pinned chats with a dash instead of a group marker", () => {
    const { container } = render(
      <TopicList
        {...baseProps}
        variant="pinned"
        pinnedConversations={[pinnedChat]}
      />,
    );

    expect(screen.getByTestId("conv-c1").dataset.leadingDash).toBe("true");

    // No chevron on the chat row and no vertical connector line.
    const chatRow = screen.getByTestId("conv-c1");
    expect(container.querySelector(".border-l")).toBeNull();
    expect(chatRow.closest('[aria-expanded]')).toBeNull();
  });

  it("owns no header or collapse toggle of its own", () => {
    render(
      <TopicList
        {...baseProps}
        variant="pinned"
        pinnedTopics={[pinnedTopic]}
        pinnedConversations={[pinnedChat]}
      />,
    );

    // The top-level PinnedSection owns both.
    expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="pinned-section"]'),
    ).toBeNull();
  });

  it("leaves pinned rows out of the default chats variant", () => {
    render(
      <TopicList
        {...baseProps}
        pinnedTopics={[pinnedTopic]}
        pinnedConversations={[pinnedChat]}
      />,
    );

    expect(screen.queryByTestId("conv-c1")).not.toBeInTheDocument();
    expect(screen.queryByText("Pinned topic")).not.toBeInTheDocument();
  });
});

describe("TopicList group colours", () => {
  // Violet is a real swatch, so the row colours are deterministic.
  const violetTopic = { id: "t2", name: "Violet topic", color: "violet" };
  const violetChat = { id: "c2", title: "Topic chat", lastModified: 1 };
  const props = {
    ...baseProps,
    pinnedTopics: [violetTopic],
    pinnedConversations: [pinnedChat],
    conversationsByTopic: new Map([["t2", [violetChat]]]),
  };
  const rowFor = (name) => screen.getByText(name).closest("[style]");
  const rulesFor = () => screen.getByTestId("conv-c2").parentElement;

  it("washes the group name in its colour and brackets its chats on both sides", () => {
    render(<TopicList {...props} variant="pinned" />);

    const row = rowFor("Violet topic");
    expect(row).toHaveAttribute("role", "button");
    // #7C3AED: 8% behind the name in light mode.
    expect(row.style.getPropertyValue("--group-tint")).toBe(
      "rgba(124, 58, 237, 0.08)",
    );
    expect(row.style.getPropertyValue("--group-tint-hover")).toBe(
      "rgba(124, 58, 237, 0.12)",
    );
    // The name row carries no vertical rules; only the chats below it are bracketed.
    expect(row.className).not.toContain("border-l-2");
    expect(row.className).not.toContain("border-r-2");

    const rules = rulesFor();
    expect(rules.className).toContain("border-x-2");
    expect(rules.style.borderLeftColor).toBe("rgba(124, 58, 237, 0.35)");
    expect(rules.style.borderRightColor).toBe("rgba(124, 58, 237, 0.35)");
  });

  it("strengthens the wash and the rules in dark mode", () => {
    render(<TopicList {...props} variant="pinned" isDark />);

    const row = rowFor("Violet topic");
    expect(row.style.getPropertyValue("--group-tint")).toBe(
      "rgba(124, 58, 237, 0.12)",
    );
    expect(rulesFor().style.borderRightColor).toBe(
      "rgba(124, 58, 237, 0.5)",
    );
  });

  it("marks the open group with a stronger wash and an accent name", () => {
    reduxMocks.pathname = "/topic/t2";
    render(<TopicList {...props} variant="pinned" />);

    const row = rowFor("Violet topic");
    expect(row.style.getPropertyValue("--group-tint")).toBe(
      "rgba(124, 58, 237, 0.16)",
    );
    expect(row.className).toContain("text-accent");
  });
});

describe("TopicList collapse all", () => {
  const pinnedGroup = { id: "t1", name: "Pinned topic", color: "#B4388D" };
  const regularGroup = { id: "t3", name: "Regular topic", color: "violet" };
  const unsortedChat = { id: "c3", title: "Unsorted chat", lastModified: 1 };
  const props = {
    ...baseProps,
    topics: [regularGroup],
    pinnedTopics: [pinnedGroup],
    unsortedConversations: [unsortedChat],
  };
  const allTopicIds = [pinnedGroup.id, regularGroup.id, UNSORTED_TOPIC_ID];
  const button = (name) => screen.getByRole("button", { name });

  it("collapses pinned, regular and unsorted topics from the new-topic row", () => {
    render(<TopicList {...props} />);

    fireEvent.click(button("Collapse all topics"));

    expect(reduxMocks.dispatch).toHaveBeenCalledWith(
      collapseTopics(allTopicIds),
    );
  });

  it("expands every topic again once they are all collapsed", () => {
    reduxMocks.collapsed = [...allTopicIds];
    render(<TopicList {...props} />);

    fireEvent.click(button("Expand all topics"));

    expect(reduxMocks.dispatch).toHaveBeenCalledWith(expandTopics(allTopicIds));
  });

  it("keeps collapsing while at least one topic is open", () => {
    reduxMocks.collapsed = [pinnedGroup.id, UNSORTED_TOPIC_ID];
    render(<TopicList {...props} />);

    fireEvent.click(button("Collapse all topics"));

    expect(reduxMocks.dispatch).toHaveBeenCalledWith(
      collapseTopics(allTopicIds),
    );
  });

  it("leaves section, workspace and agent collapse ids alone", () => {
    reduxMocks.collapsed = [PINNED_COLLAPSE_ID, "__chats__", "ws-1"];
    render(<TopicList {...props} />);

    fireEvent.click(button("Collapse all topics"));

    const [action] = reduxMocks.dispatch.mock.calls.at(-1);
    expect(action.payload).toEqual(allTopicIds);
  });

  it("hides the control when there is nothing to collapse", () => {
    render(<TopicList {...baseProps} />);

    expect(
      screen.queryByRole("button", { name: /all topics/ }),
    ).not.toBeInTheDocument();
  });
});
