import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopicList from "../TopicList";

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: () => [],
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

describe("TopicList pinned rows", () => {
  it("indents pinned chats like topic children", () => {
    const { container } = render(
      <TopicList {...baseProps} pinnedConversations={[pinnedChat]} />,
    );

    const row = screen.getByTestId("conv-c1");
    const section = container.querySelector('[data-guide="pinned-chats"]');
    const wrapper = row.parentElement;

    expect(section?.contains(row)).toBe(true);
    expect(wrapper?.className).toContain("ml-2");
  });

  it("marks pinned chats with a dash instead of a group line", () => {
    const { container } = render(
      <TopicList {...baseProps} pinnedConversations={[pinnedChat]} />,
    );

    expect(screen.getByTestId("conv-c1").dataset.leadingDash).toBe("true");

    const section = container.querySelector('[data-guide="pinned-chats"]');
    // No vertical line that would suggest a parent group, and no chevron.
    expect(section?.querySelector(".border-l")).toBeNull();
    expect(section?.querySelector("[aria-expanded]")).toBeNull();
  });

  it("leaves pinned topics as top-level rows with their chevron", () => {
    render(
      <TopicList
        {...baseProps}
        pinnedTopics={[{ id: "t1", name: "Pinned topic", color: "#B4388D" }]}
        pinnedConversations={[pinnedChat]}
      />,
    );

    const topicLabel = screen.getByText("Pinned topic");
    expect(topicLabel.closest(".ml-2")).toBeNull();
    expect(screen.getByTestId("conv-c1").parentElement?.className).toContain(
      "ml-2",
    );
  });
});
