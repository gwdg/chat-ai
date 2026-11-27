import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const openModal = vi.fn();

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.path ? `${key}:${options.path}` : key),
  }),
}));

import WorkspaceGitButton, { supportsGit } from "../WorkspaceGitButton";

const provider = (overrides = {}) => ({
  sourceId: "workspace-root:w1",
  kind: "browser",
  capabilities: { read: true, write: true, delete: true, mkdir: true },
  ...overrides,
});

describe("supportsGit", () => {
  it("accepts a writable browser, local or saia-fs source", () => {
    expect(supportsGit(provider())).toBe(true);
    expect(supportsGit(provider({ kind: "local" }))).toBe(true);
    expect(supportsGit(provider({ kind: "saia-fs" }))).toBe(true);
  });

  it("rejects read-only sources, flat sources and sources that cannot write", () => {
    expect(supportsGit(provider(), true)).toBe(false);
    expect(supportsGit(provider({ kind: "arcana" }))).toBe(false);
    expect(supportsGit(provider({ kind: "mcp" }))).toBe(false);
    expect(
      supportsGit(provider({ capabilities: { read: true, write: false } })),
    ).toBe(false);
    expect(supportsGit(null)).toBe(false);
  });
});

describe("WorkspaceGitButton", () => {
  it("opens the Git menu for the selected folder", async () => {
    openModal.mockClear();
    render(
      <WorkspaceGitButton
        provider={provider()}
        path="/src/components"
        displayPath="/project/src/components"
      />,
    );

    const button = screen.getByRole("button", { name: "workspace.git.button" });
    expect(button).toBeEnabled();
    await userEvent.click(button);

    expect(openModal).toHaveBeenCalledWith(
      "gitMenu",
      expect.objectContaining({
        path: "/src/components",
        displayPath: "/project/src/components",
        readOnly: false,
      }),
    );
  });

  it("is disabled for a read-only or unsupported folder", () => {
    const { rerender } = render(
      <WorkspaceGitButton provider={provider()} readOnly />,
    );
    expect(screen.getByRole("button")).toBeDisabled();

    rerender(<WorkspaceGitButton provider={provider({ kind: "arcana" })} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
