import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicList, { PINNED_COLLAPSE_ID } from "../TopicList";
import { toggleTopic } from "../../../Redux/reducers/interfaceSettingsSlice";

const reduxMocks = vi.hoisted(() => ({
  collapsed: [],
  dispatch: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => reduxMocks.dispatch,
  useSelector: () => reduxMocks.collapsed,
}));
vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: "/" }),
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

const pinnedHeader = () =>
  document.querySelector('[data-guide="pinned-chats"] > button');

beforeEach(() => {
  reduxMocks.collapsed = [];
  reduxMocks.dispatch.mockClear();
});

describe("TopicList pinned rows", () => {
  it("marks pinned chats with a dash instead of a group marker", () => {
    const { container } = render(
      <TopicList {...baseProps} pinnedConversations={[pinnedChat]} />,
    );

    expect(screen.getByTestId("conv-c1").dataset.leadingDash).toBe("true");

    // No chevron on the chat row and no vertical connector line.
    const chatRow = screen.getByTestId("conv-c1");
    expect(
      container.querySelector('[data-guide="pinned-chats"] .border-l'),
    ).toBeNull();
    expect(chatRow.closest('[aria-expanded]')).toBeNull();
  });

  it("keeps pinned chats at the group row, not nested under a wrapper", () => {
    const { container } = render(
      <TopicList {...baseProps} pinnedConversations={[pinnedChat]} />,
    );

    const section = container.querySelector('[data-guide="pinned-chats"]');
    expect(screen.getByTestId("conv-c1").parentElement).toBe(section);
  });

  it("toggles the pinned section through the persisted topic state", () => {
    render(<TopicList {...baseProps} pinnedConversations={[pinnedChat]} />);

    fireEvent.click(pinnedHeader());

    expect(reduxMocks.dispatch).toHaveBeenCalledWith(
      toggleTopic(PINNED_COLLAPSE_ID),
    );
  });

  it("hides pinned rows while the section is collapsed", () => {
    reduxMocks.collapsed = [PINNED_COLLAPSE_ID];
    render(
      <TopicList
        {...baseProps}
        pinnedTopics={[pinnedTopic]}
        pinnedConversations={[pinnedChat]}
      />,
    );

    expect(pinnedHeader()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("conv-c1")).not.toBeInTheDocument();
    expect(screen.queryByText("Pinned topic")).not.toBeInTheDocument();
  });

  it("shows pinned rows while the section is expanded", () => {
    render(
      <TopicList
        {...baseProps}
        pinnedTopics={[pinnedTopic]}
        pinnedConversations={[pinnedChat]}
      />,
    );

    expect(pinnedHeader()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("conv-c1")).toBeInTheDocument();
    expect(screen.getByText("Pinned topic")).toBeInTheDocument();
  });
});
