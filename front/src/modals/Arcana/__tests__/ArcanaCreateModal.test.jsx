import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaCreateModal from "../ArcanaCreateModal";

const mocks = vi.hoisted(() => ({
  createCollection: vi.fn(),
  refreshArcanas: vi.fn(),
  t: vi.fn((key) => key),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
  Trans: ({ i18nKey }) => i18nKey,
}));

vi.mock("../../../workspace/arcanas", () => ({
  arcanasProvider: () => ({ createCollection: mocks.createCollection }),
  refreshArcanas: (...args) => mocks.refreshArcanas(...args),
}));

describe("ArcanaCreateModal", () => {
  beforeEach(() => {
    mocks.createCollection.mockReset();
    mocks.createCollection.mockResolvedValue(undefined);
    mocks.refreshArcanas.mockReset();
    mocks.refreshArcanas.mockResolvedValue([]);
  });

  it("creates the collection with its description", async () => {
    const onClose = vi.fn();
    render(<ArcanaCreateModal isOpen onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("arcanas.name_placeholder"), {
      target: { value: "  papers " },
    });
    fireEvent.change(
      screen.getByPlaceholderText("arcanas.description_placeholder"),
      { target: { value: " Peer-reviewed papers " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "arcanas.create" }));

    await waitFor(() =>
      expect(mocks.createCollection).toHaveBeenCalledWith(
        "papers",
        "Peer-reviewed papers",
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("creates the collection without a description when the field is empty", async () => {
    render(<ArcanaCreateModal isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("arcanas.name_placeholder"), {
      target: { value: "papers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "arcanas.create" }));

    await waitFor(() =>
      expect(mocks.createCollection).toHaveBeenCalledWith("papers", ""),
    );
  });
});
