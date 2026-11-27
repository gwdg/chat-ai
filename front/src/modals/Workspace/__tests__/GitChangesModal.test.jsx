import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
  // `BaseModal` renders its title through `Trans`.
  Trans: ({ i18nKey }) => i18nKey ?? null,
}));

import GitChangesModal from "../GitChangesModal";
import { streamOf } from "../../../workspace/bytes";
import { initGitRepository } from "../../../workspace/git/repo";
import { createMemoryProvider } from "../../../workspace/git/__tests__/memoryProvider";

const renderDialog = (provider) =>
  render(
    <GitChangesModal
      isOpen
      onClose={() => {}}
      provider={provider}
      path="/repo"
      displayPath="/repo"
    />,
  );

describe("GitChangesModal", () => {
  it("carries the tour hooks of the staging lists and the commit box", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/repo");
    await initGitRepository(provider, "/repo");
    await provider.write("/repo/a.txt", streamOf("hello\n"), {
      overwrite: true,
    });

    renderDialog(provider);

    await waitFor(() =>
      expect(document.querySelector('[data-guide="git-changes-unstaged"]')).toBeTruthy(),
    );
    for (const hook of [
      "git-changes",
      "git-changes-staged",
      "git-changes-unstaged",
      "git-commit-box",
      "git-commit",
    ]) {
      expect(document.querySelector(`[data-guide="${hook}"]`)).toBeTruthy();
    }
  });

  it("says a clean repository has nothing to commit", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/repo");
    await initGitRepository(provider, "/repo");

    renderDialog(provider);

    await waitFor(() =>
      expect(screen.getByText("workspace.git.clean")).toBeTruthy(),
    );
  });
});
