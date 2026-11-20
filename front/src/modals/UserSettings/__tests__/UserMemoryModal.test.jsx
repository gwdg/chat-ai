import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserMemoryModal from "../UserMemoryModal";

const { mockState } = vi.hoisted(() => ({
  mockState: {
    user_settings: {
      memories: [],
      memory_groups: [{ id: "work", name: "Work" }],
      default_memory_group: "default",
      memory_mode: 1,
    },
  },
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) => selector(mockState),
  useDispatch: () => vi.fn(),
}));

vi.mock("../../ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));

vi.mock("../../BaseModal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

describe("UserMemoryModal", () => {
  beforeEach(() => {
    mockState.user_settings.memories = [];
  });

  it("does not offer a group selector for a new memory when opened from a group", () => {
    render(<UserMemoryModal isOpen onClose={vi.fn()} groupId="work" />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("does not offer a group selector for saved memories", () => {
    mockState.user_settings.memories = [
      {
        id: "memory-1",
        text: "Saved memory",
        groupId: "work",
        createdAt: new Date().toISOString(),
      },
    ];

    render(<UserMemoryModal isOpen onClose={vi.fn()} groupId="work" />);

    expect(screen.getByText("Saved memory")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("offers a group selector when no group is specified", () => {
    render(<UserMemoryModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
