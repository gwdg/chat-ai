import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  topicId: "topic-1",
  folders: [{ id: "topic-1", name: "Research", icon: "default", color: "violet" }],
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ topicId: mocks.topicId }),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));
vi.mock("../../db", () => ({
  setFolderColor: vi.fn(),
  setFolderIcon: vi.fn(),
  useConversationList: () => [],
  useFolderList: () => mocks.folders,
}));
vi.mock("../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../../hooks/useUpdateModelsData", () => ({
  useUpdateModelsData: () => ({}),
}));
vi.mock("../../hooks/useUpdateUserData", () => ({
  useUpdateUserData: () => ({}),
}));
vi.mock("../../components/Sidebar/SidebarWrapper", () => ({
  default: () => <div data-testid="sidebar" />,
}));
vi.mock("../../components/Header/AnnouncementBar", () => ({ default: () => null }));
vi.mock("../../components/Header/Header", () => ({ default: () => null }));
vi.mock("../../components/Footer/CollapsibleFooter", () => ({ default: () => null }));
vi.mock("../../components/TopicMaster/TopicComposer", () => ({ default: () => null }));

import TopicMasterPage from "../TopicMasterPage";

beforeEach(() => {
  mocks.openModal.mockReset();
  mocks.topicId = "topic-1";
});

describe("TopicMasterPage header", () => {
  it("starts the name at the sidebar edge, not in the centred column", () => {
    render(<TopicMasterPage />);

    const header = screen.getByTestId("topic-page-header");
    expect(header.querySelector(".mx-auto")).toBeNull();
    expect(header.querySelector(".max-w-3xl")).toBeNull();
    expect(header).toHaveTextContent("Research");
  });

  it("floats the topic's delete where a chat floats Close Chat", () => {
    render(<TopicMasterPage />);

    const button = screen.getByTestId("topic-page-delete");
    expect(button.closest("div.absolute").className).toContain("right-2");
    expect(button.className).toContain("btn-circle");
    expect(screen.getByTestId("topic-page-header")).not.toContainElement(
      button,
    );
  });

  it("offers no delete for Unsorted Chats", () => {
    mocks.topicId = "__unsorted__";
    render(<TopicMasterPage />);

    expect(screen.getByTestId("topic-page-header")).toHaveTextContent(
      "Unsorted Chats",
    );
    expect(screen.queryByTestId("topic-page-delete")).toBeNull();
  });
});
