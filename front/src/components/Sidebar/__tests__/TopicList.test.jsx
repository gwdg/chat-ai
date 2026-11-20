import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicList, {
  CREATED_TOPIC_ID,
  DATE_TOPIC_ID,
  PINNED_COLLAPSE_ID,
  SIZE_TOPIC_ID,
  UNSORTED_TOPIC_ID,
  dateBucketCollapseId,
} from "../TopicList";
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
    data-accent={options.accentHex ?? ""}
    data-flush={options.flush === true ? "true" : "false"}
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

  it("opens the options menu on a pinned topic and unpins it", () => {
    const pinned = { ...pinnedTopic, pinned: true };
    const onToggleTopicPinned = vi.fn();
    render(
      <TopicList
        {...baseProps}
        variant="pinned"
        pinnedTopics={[pinned]}
        onToggleTopicPinned={onToggleTopicPinned}
      />,
    );

    // The pinned variant used to return before the menu was mounted, so its
    // "…" button toggled a menu that never appeared.
    fireEvent.click(screen.getByRole("button", { name: "Topic options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpin topic" }));

    expect(onToggleTopicPinned).toHaveBeenCalledWith({
      id: "t1",
      name: "Pinned topic",
      color: "#B4388D",
      icon: undefined,
      pinned: true,
    });
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
    // #7C3AED: 6% behind the name in light mode.
    expect(row.style.getPropertyValue("--group-tint")).toBe(
      "rgba(124, 58, 237, 0.06)",
    );
    expect(row.style.getPropertyValue("--group-tint-hover")).toBe(
      "rgba(124, 58, 237, 0.09)",
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
      "rgba(124, 58, 237, 0.09)",
    );
    expect(rulesFor().style.borderRightColor).toBe(
      "rgba(124, 58, 237, 0.5)",
    );
  });

  it("gives its chats its own colour to wear when one is open", () => {
    render(<TopicList {...props} variant="pinned" />);

    // Under the topic: the topic's colour, running between its two rules.
    expect(screen.getByTestId("conv-c2")).toHaveAttribute(
      "data-accent",
      "#7C3AED",
    );
    expect(screen.getByTestId("conv-c2")).toHaveAttribute(
      "data-flush",
      "true",
    );
    // A pinned chat has no rules to fill, so it keeps its own rounded shape.
    expect(screen.getByTestId("conv-c1")).toHaveAttribute(
      "data-flush",
      "false",
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

describe("TopicList grouping headings", () => {
  const chat = { id: "c6", title: "Grouped chat", lastModified: 1 };
  const dateGroup = { key: "today", conversations: [chat] };
  const button = (name) => screen.getByRole("button", { name });

  it("wears the all-caps section type of the by-date and by-size labels", () => {
    render(
      <TopicList
        {...baseProps}
        topics={[{ id: "t6", name: "Named topic", color: "violet" }]}
      />,
    );

    const label = screen.getByText("Topics");
    expect(label.className).toContain("text-[10px]");
    expect(label.className).toContain("font-semibold");
    expect(label.className).toContain("uppercase");
    expect(label.className).toContain("tracking-wider");
    expect(label.className).toContain("text-base-content/45");
  });

  it("folds every date bucket from the by-date heading", () => {
    render(
      <TopicList {...baseProps} grouping="date" dateGroups={[dateGroup]} />,
    );

    expect(screen.getByText("By date")).toBeInTheDocument();
    fireEvent.click(button("Collapse all chats"));

    expect(reduxMocks.dispatch).toHaveBeenCalledWith(
      collapseTopics([dateBucketCollapseId(DATE_TOPIC_ID, "today")]),
    );
  });

  it("folds the creation-date buckets under their own parent id", () => {
    render(
      <TopicList
        {...baseProps}
        grouping="created"
        creationDateGroups={[dateGroup]}
      />,
    );

    fireEvent.click(button("Collapse all chats"));

    expect(reduxMocks.dispatch).toHaveBeenCalledWith(
      collapseTopics([dateBucketCollapseId(CREATED_TOPIC_ID, "today")]),
    );
  });

  it("expands the buckets again once all of them are folded", () => {
    reduxMocks.collapsed = [dateBucketCollapseId(DATE_TOPIC_ID, "today")];
    render(
      <TopicList {...baseProps} grouping="date" dateGroups={[dateGroup]} />,
    );

    fireEvent.click(button("Expand all chats"));

    expect(reduxMocks.dispatch).toHaveBeenCalledWith(
      expandTopics([dateBucketCollapseId(DATE_TOPIC_ID, "today")]),
    );
  });

  it("folds the single storage-size list and hides its chats", () => {
    reduxMocks.collapsed = [SIZE_TOPIC_ID];
    render(
      <TopicList {...baseProps} grouping="size" sizeConversations={[chat]} />,
    );

    expect(screen.getByText("By storage size")).toBeInTheDocument();
    expect(screen.queryByTestId("conv-c6")).not.toBeInTheDocument();
    fireEvent.click(button("Expand all chats"));

    expect(reduxMocks.dispatch).toHaveBeenCalledWith(
      expandTopics([SIZE_TOPIC_ID]),
    );
  });

  it("draws no control when a heading has nothing to fold", () => {
    render(<TopicList {...baseProps} grouping="date" dateGroups={[]} />);

    expect(
      screen.queryByRole("button", { name: /all chats/ }),
    ).not.toBeInTheDocument();
  });
});

describe("TopicList row controls", () => {
  it("puts the disclosure arrow at the leading edge of the topic row", () => {
    const topic = { id: "t4", name: "Trailing topic", color: "violet" };
    render(
      <TopicList
        {...baseProps}
        topics={[topic]}
        conversationsByTopic={
          new Map([["t4", [{ id: "c4", title: "Topic chat", lastModified: 1 }]]])
        }
      />,
    );

    const row = screen.getByText("Trailing topic").closest('[role="button"]');
    const toggle = row.querySelector('button[aria-label="Collapse topic"]');
    const lead = row.firstElementChild;

    // The chevron opens the row, like the Chats and Workspaces bands; the
    // emoji/icon slot follows it in the same 4px rhythm.
    expect(lead.contains(toggle)).toBe(true);
    expect(lead.firstElementChild).toBe(toggle);
    expect(lead.className).toContain("gap-1");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Nothing folds the topic from the tail any more.
    expect(row.lastElementChild.contains(toggle)).toBe(false);
  });

  it("keeps the count and the options menu in one flush tail group", () => {
    const topic = { id: "t4", name: "Trailing topic", color: "violet" };
    render(
      <TopicList
        {...baseProps}
        topics={[topic]}
        conversationsByTopic={
          new Map([["t4", [{ id: "c4", title: "Topic chat", lastModified: 1 }]]])
        }
      />,
    );

    const row = screen.getByText("Trailing topic").closest('[role="button"]');
    const tail = row.lastElementChild;
    // The count leads the group; no gap utility, so the menu sits flush.
    expect(tail.firstElementChild.textContent).toBe("1");
    expect([...tail.querySelectorAll("button")].map((b) => b.ariaLabel)).toEqual(
      ["Topic options"],
    );
    expect(tail.className).not.toContain("gap-");
    // The band is the same 40px box as a workspace band.
    expect(row.className).toContain("min-h-9");
    expect(row.className).toContain("px-1");
    expect(row.className).not.toContain("py-2");
  });
});

describe("TopicList double click", () => {
  const topic = { id: "t5", name: "Double topic", color: "violet" };
  const props = {
    ...baseProps,
    topics: [topic],
    conversationsByTopic: new Map([
      ["t5", [{ id: "c5", title: "Topic chat", lastModified: 1 }]],
    ]),
  };

  it("folds a topic from a double click on its label", () => {
    vi.useFakeTimers();
    try {
      const onOpenTopic = vi.fn();
      render(<TopicList {...props} onOpenTopic={onOpenTopic} />);

      // A real user double-clicks the topic name, not the bare row element.
      const label = screen.getByText("Double topic");
      fireEvent.click(label, { detail: 1 });
      fireEvent.click(label, { detail: 2 });
      fireEvent.doubleClick(label);
      act(() => vi.advanceTimersByTime(400));

      expect(reduxMocks.dispatch).toHaveBeenCalledWith(toggleTopic("t5"));
      expect(onOpenTopic).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a topic after a single click once no second click follows", () => {
    vi.useFakeTimers();
    try {
      const onOpenTopic = vi.fn();
      render(<TopicList {...props} onOpenTopic={onOpenTopic} />);

      const label = screen.getByText("Double topic");
      fireEvent.click(label, { detail: 1 });

      expect(onOpenTopic).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(400));
      expect(onOpenTopic).toHaveBeenCalledWith("t5");
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the disclosure arrow in charge of its own clicks", () => {
    render(<TopicList {...props} />);

    const row = screen.getByText("Double topic").closest('[role="button"]');
    const toggle = row.querySelector('button[aria-label="Collapse topic"]');

    fireEvent.doubleClick(toggle);

    expect(reduxMocks.dispatch).not.toHaveBeenCalled();
  });
});
