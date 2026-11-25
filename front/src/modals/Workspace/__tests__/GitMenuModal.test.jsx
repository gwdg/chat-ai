import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const openModal = vi.fn();

vi.mock("../../ModalContext", () => ({
  useModal: () => ({ openModal }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
  // `BaseModal` renders its title through `Trans`.
  Trans: ({ i18nKey }) => i18nKey ?? null,
}));

import GitMenuModal from "../GitMenuModal";
import { createMemoryProvider } from "../../../workspace/git/__tests__/memoryProvider";

describe("GitMenuModal", () => {
  it("offers init and clone in a folder that is not a repository", async () => {
    const provider = createMemoryProvider();

    render(
      <GitMenuModal
        isOpen
        onClose={() => {}}
        provider={provider}
        path="/"
        displayPath="/"
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("workspace.git.not_a_repository")).toBeTruthy(),
    );
    expect(screen.getByText("workspace.git.init")).toBeTruthy();
    expect(screen.getByText("workspace.git.clone")).toBeTruthy();
  });

  it("explains why a read-only folder cannot be used", async () => {
    const provider = createMemoryProvider();

    render(
      <GitMenuModal
        isOpen
        onClose={() => {}}
        provider={provider}
        path="/"
        displayPath="/"
        readOnly
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText("workspace.git.error.read_only_provider"),
      ).toBeTruthy(),
    );
    expect(screen.queryByText("workspace.git.init")).toBeNull();
  });
});
