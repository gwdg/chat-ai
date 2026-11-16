import { vi } from "vitest";

/**
 * Stand-in for the browser download machinery: captures the blobs that `URL.createObjectURL`
 * receives, so a test can assert what a click on a download button would have saved. Also mutes
 * the navigation and alert side effects of jsdom.
 */
export function captureDownloads() {
  const blobs = [];
  const createElement = vi.spyOn(document, "createElement");
  const original = {
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
    click: HTMLAnchorElement.prototype.click,
    alert: window.alert,
  };
  URL.createObjectURL = vi.fn((blob) => {
    blobs.push(blob);
    return `blob:download-${blobs.length}`;
  });
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
  window.alert = vi.fn();

  return {
    blobs,
    alert: window.alert,
    /** The links that were actually prepared as downloads. */
    links: () =>
      createElement.mock.results
        .map((result) => result.value)
        .filter(
          (element) =>
            element instanceof HTMLAnchorElement && element.download !== "",
        ),
    bytes: async (index = 0) =>
      new Uint8Array(await blobs[index].arrayBuffer()),
    restore() {
      if (original.createObjectURL) URL.createObjectURL = original.createObjectURL;
      else delete URL.createObjectURL;
      if (original.revokeObjectURL) URL.revokeObjectURL = original.revokeObjectURL;
      else delete URL.revokeObjectURL;
      HTMLAnchorElement.prototype.click = original.click;
      window.alert = original.alert;
      createElement.mockRestore();
    },
  };
}
