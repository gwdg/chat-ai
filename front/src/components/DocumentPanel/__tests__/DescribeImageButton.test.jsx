import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  available: true,
  explainImage: vi.fn(async () => "A blue bar chart."),
  saveDescription: vi.fn(async () => "/charts/chart-description.md"),
  downloadBlob: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../../hooks/useVisionModelAvailable", () => ({
  useVisionModelAvailable: () => mocks.available,
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({
    notifySuccess: mocks.notifySuccess,
    notifyError: mocks.notifyError,
  }),
}));

vi.mock("../../../apis/agentEndpoints", () => ({
  EXPLAIN_IMAGE_MODEL: () => "gemma-4-31b-it",
  explainImage: (...args) => mocks.explainImage(...args),
}));

vi.mock("../../../utils/download", () => ({
  downloadBlob: (...args) => mocks.downloadBlob(...args),
}));

import DescribeImageButton, { descriptionFileName } from "../DescribeImageButton";

const preview = (extra = {}) => ({
  entry: { name: "chart.png", mime: "image/png" },
  url: "blob:chart",
  bytes: new Uint8Array([1, 2, 3]),
  ...extra,
});

const renderButton = (value = preview()) =>
  render(<DescribeImageButton preview={value} />);

describe("DescribeImageButton", () => {
  beforeEach(() => {
    mocks.available = true;
    mocks.explainImage.mockClear();
    mocks.saveDescription.mockClear();
    mocks.downloadBlob.mockClear();
    mocks.notifySuccess.mockClear();
    mocks.notifyError.mockClear();
  });

  // The button stays in the header, greyed out, when the deployment lists no
  // vision model: hiding it would leave the action unexplained.
  it("is greyed out while no vision model is available", () => {
    mocks.available = false;

    renderButton();

    expect(screen.getByTestId("describe-image")).toBeDisabled();
    expect(screen.getByTestId("describe-image")).toHaveAttribute(
      "title",
      "No vision model is available for this deployment",
    );
  });

  // Clicking Describe a second time must not pay for another model call nor
  // overwrite a description the user may have edited.
  it("opens an existing description instead of analyzing again", async () => {
    const openDescription = vi.fn(async () => "/charts/chart-description.md");
    const saveDescription = vi.fn();
    renderButton(
      preview({
        descriptionExists: async () => true,
        openDescription,
        saveDescription,
      }),
    );

    fireEvent.click(screen.getByTestId("describe-image"));

    await waitFor(() =>
      expect(openDescription).toHaveBeenCalledWith("chart-description.md"),
    );
    expect(mocks.explainImage).not.toHaveBeenCalled();
    expect(saveDescription).not.toHaveBeenCalled();
    expect(mocks.notifySuccess).toHaveBeenCalledWith(
      "Opened chart-description.md",
    );
  });

  it("asks the model when no description exists yet", async () => {
    const openDescription = vi.fn();
    renderButton(
      preview({ descriptionExists: async () => false, openDescription }),
    );

    fireEvent.click(screen.getByTestId("describe-image"));

    await waitFor(() => expect(mocks.explainImage).toHaveBeenCalled());
    expect(openDescription).not.toHaveBeenCalled();
  });

  it("writes the description beside the image when the host can save", async () => {
    const saveDescription = vi.fn(async () => "/charts/chart-description.md");
    renderButton(preview({ saveDescription }));

    fireEvent.click(screen.getByTestId("describe-image"));

    await waitFor(() => expect(saveDescription).toHaveBeenCalled());
    expect(mocks.explainImage).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      "image/png",
      expect.any(String),
    );
    expect(saveDescription).toHaveBeenCalledWith(
      "# chart.png\n\n_Automatically described with gemma-4-31b-it_\n\nA blue bar chart.\n",
      "chart-description.md",
    );
    expect(mocks.notifySuccess).toHaveBeenCalledWith(
      "Saved chart-description.md",
    );
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
  });

  it("downloads the Markdown when the host has nowhere to write it", async () => {
    renderButton();

    fireEvent.click(screen.getByTestId("describe-image"));

    await waitFor(() => expect(mocks.downloadBlob).toHaveBeenCalled());
    const [blob, name] = mocks.downloadBlob.mock.calls[0];
    expect(name).toBe("chart-description.md");
    expect(await blob.text()).toContain("A blue bar chart.");
    expect(mocks.notifySuccess).toHaveBeenCalledWith(
      "Downloaded chart-description.md",
    );
  });

  it("reports a failed description instead of saving anything", async () => {
    mocks.explainImage.mockRejectedValueOnce(new Error("model offline"));
    const saveDescription = vi.fn();

    renderButton(preview({ saveDescription }));
    fireEvent.click(screen.getByTestId("describe-image"));

    await waitFor(() =>
      expect(mocks.notifyError).toHaveBeenCalledWith(
        "Could not describe the image: model offline",
      ),
    );
    expect(saveDescription).not.toHaveBeenCalled();
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
  });

  it("names the description after the image without its extension", () => {
    expect(descriptionFileName("photo.final.jpeg")).toBe(
      "photo.final-description.md",
    );
    expect(descriptionFileName("no-extension")).toBe(
      "no-extension-description.md",
    );
  });
});
