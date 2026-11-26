import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { saveFileReady } from "../../db";
import { useConversationFilePreview } from "../useConversationFilePreview";

// Chrome rejects a URL longer than 2 MB, and base64 adds a third on top, so the
// `data:` URL this preview used to carry was silently refused for anything above
// ~1.5 MB: a 12 MB PDF rendered as an empty frame.
describe("useConversationFilePreview", () => {
  it("hands a large attachment over as an object URL, not a data URL", async () => {
    const bytes = new Uint8Array(12 * 1024 * 1024);
    const id = await saveFileReady(
      "preview-large-pdf",
      new File([bytes], "scan.pdf", { type: "application/pdf" }),
    );

    const { result } = renderHook(() =>
      useConversationFilePreview(id, "scan.pdf"),
    );

    await waitFor(() => expect(result.current.url).toMatch(/^blob:/));
    expect(result.current.url).not.toMatch(/^data:/);
    expect(result.current.entry).toMatchObject({
      name: "scan.pdf",
      mime: "application/pdf",
    });
  });
});
