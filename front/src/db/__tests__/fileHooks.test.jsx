import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { saveFileReady, useFileBase64, useFileContent } from "../index";

// Switching the preview from one file to another must not keep serving the previous
// file's bytes, which the preview then renders as a broken image.
describe("file hooks", () => {
  it("drops the previous file's data URL when the id changes", async () => {
    const first = await saveFileReady(
      "hooks-switch",
      new File(["first"], "first.txt", { type: "text/plain" }),
    );
    const second = await saveFileReady(
      "hooks-switch",
      new File(["second"], "second.txt", { type: "text/plain" }),
    );

    const { result, rerender } = renderHook(
      ({ fileId }) => useFileBase64(fileId),
      { initialProps: { fileId: first } },
    );
    await waitFor(() => expect(result.current).toMatch(/^data:text\/plain/));

    rerender({ fileId: second });

    expect(result.current).toBeNull();
  });

  it("drops the previous file's text when the id changes", async () => {
    const first = await saveFileReady(
      "hooks-switch",
      new File(["first text"], "first.md", { type: "text/markdown" }),
    );
    const second = await saveFileReady(
      "hooks-switch",
      new File(["second text"], "second.md", { type: "text/markdown" }),
    );

    const { result, rerender } = renderHook(
      ({ fileId }) => useFileContent(fileId),
      { initialProps: { fileId: first } },
    );
    await waitFor(() => expect(result.current).toBe("first text"));

    rerender({ fileId: second });

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe("second text"));
  });
});
