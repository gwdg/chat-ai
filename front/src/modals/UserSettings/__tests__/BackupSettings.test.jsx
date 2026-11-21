import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BackupSettings from "../BackupSettings";

const backup = vi.hoisted(() => ({
  createBackup: vi.fn(),
  inspectBackup: vi.fn(),
  restoreBackup: vi.fn(),
}));
const download = vi.hoisted(() => ({ downloadText: vi.fn() }));

vi.mock("../../../backup/package", () => backup);
vi.mock("../../../utils/download", () => download);

const PASSPHRASE = "correct horse battery staple";

const renderSection = () => render(<BackupSettings />);

const fillCreate = (passphrase = PASSPHRASE, confirm = PASSPHRASE) => {
  fireEvent.change(screen.getByLabelText("Passphrase"), {
    target: { value: passphrase },
  });
  fireEvent.change(screen.getByLabelText("Repeat passphrase"), {
    target: { value: confirm },
  });
};

const chooseFile = async (text = "sealed") => {
  const file = new File(["x"], "chat-ai-backup.chataibackup", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  fireEvent.change(screen.getByLabelText("Backup file"), {
    target: { files: [file] },
  });
  await waitFor(() => expect(backup.inspectBackup).toHaveBeenCalledWith(text));
};

beforeEach(() => {
  backup.createBackup.mockReset();
  backup.inspectBackup.mockReset();
  backup.restoreBackup.mockReset();
  download.downloadText.mockReset();
  backup.createBackup.mockResolvedValue({
    text: "sealed-file",
    fileName: "chat-ai-backup-20261121-103015.chataibackup",
    createdAt: Date.UTC(2026, 10, 21, 10, 30, 15),
    counts: { records: 4, assets: 1 },
    records: 4,
    assets: 1,
    skipped: [],
  });
  backup.inspectBackup.mockReturnValue({
    createdAt: Date.UTC(2026, 10, 21, 10, 30, 15),
    counts: { records: 4 },
  });
  backup.restoreBackup.mockResolvedValue({
    createdAt: Date.UTC(2026, 10, 21, 10, 30, 15),
    records: 4,
    applied: { conversations: 3, settings: 1 },
    skipped: [],
    unknownNamespaces: [],
  });
});

describe("BackupSettings", () => {
  it("creates and downloads a backup with the chosen passphrase", async () => {
    renderSection();
    fillCreate();
    fireEvent.click(
      screen.getByRole("button", { name: /create and download backup/i }),
    );

    await waitFor(() =>
      expect(backup.createBackup).toHaveBeenCalledWith(PASSPHRASE),
    );
    expect(download.downloadText).toHaveBeenCalledWith(
      "sealed-file",
      "application/json",
      "chat-ai-backup-20261121-103015.chataibackup",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/downloaded \(4 items\)/i);
  });

  it("refuses mismatched passphrases before touching the database", async () => {
    renderSection();
    fillCreate(PASSPHRASE, "something else");
    fireEvent.click(
      screen.getByRole("button", { name: /create and download backup/i }),
    );

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(backup.createBackup).not.toHaveBeenCalled();
    expect(download.downloadText).not.toHaveBeenCalled();
  });

  it("shows the date of a chosen file before restoring it", async () => {
    renderSection();
    await chooseFile();

    expect(screen.getByText(/backup from .*4 items/i)).toBeInTheDocument();
  });

  it("restores only after the overwrite is confirmed", async () => {
    renderSection();
    await chooseFile();

    fireEvent.change(screen.getByLabelText("Backup passphrase"), {
      target: { value: PASSPHRASE },
    });
    fireEvent.click(screen.getByRole("button", { name: /restore backup/i }));
    expect(await screen.findByText(/confirm that the restore/i)).toBeInTheDocument();
    expect(backup.restoreBackup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /restore backup/i }));

    await waitFor(() =>
      expect(backup.restoreBackup).toHaveBeenCalledWith("sealed", PASSPHRASE),
    );
    expect(screen.getByText(/backup restored: 4 items/i)).toBeInTheDocument();
  });

  it("shows an error for a file that is not a backup", async () => {
    backup.inspectBackup.mockImplementation(() => {
      throw new Error("This file is not a Chat AI backup.");
    });
    renderSection();
    const file = new File(["nope"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("nope") });
    fireEvent.change(screen.getByLabelText("Backup file"), {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(/not a readable Chat AI backup/i),
    ).toBeInTheDocument();
  });
});
