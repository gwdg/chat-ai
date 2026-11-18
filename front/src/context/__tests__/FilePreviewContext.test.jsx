import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilePreviewProvider, useFilePreview } from "../FilePreviewContext";

const wrapper = ({ children }) => (
  <FilePreviewProvider>{children}</FilePreviewProvider>
);

describe("FilePreviewContext", () => {
  it("closes the preview when the same file is clicked again", () => {
    const { result } = renderHook(() => useFilePreview(), { wrapper });

    act(() => result.current.toggleFilePreview({ fileId: "file-a" }));
    expect(result.current.preview?.fileId).toBe("file-a");

    act(() => result.current.toggleFilePreview({ fileId: "file-a" }));
    expect(result.current.preview).toBeNull();
  });

  it("switches to another file and keeps the preview open", () => {
    const { result } = renderHook(() => useFilePreview(), { wrapper });

    act(() => result.current.toggleFilePreview({ fileId: "file-a" }));
    act(() =>
      result.current.toggleFilePreview({ fileId: "file-b", name: "b.png" }),
    );

    expect(result.current.preview).toMatchObject({
      fileId: "file-b",
      name: "b.png",
    });
  });

  it("closes explicitly and ignores requests without a file", () => {
    const { result } = renderHook(() => useFilePreview(), { wrapper });

    act(() => result.current.toggleFilePreview({}));
    expect(result.current.preview).toBeNull();

    act(() => result.current.toggleFilePreview({ fileId: "file-a" }));
    act(() => result.current.closeFilePreview());
    expect(result.current.preview).toBeNull();
  });
});
