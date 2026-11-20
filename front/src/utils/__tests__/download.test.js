import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  downloadBlob,
  downloadSvg,
  downloadText,
  renderedFilename,
} from "../download";
import { captureDownloads } from "../../test/downloads";

describe("downloadBlob", () => {
  let downloads;

  beforeEach(() => {
    downloads = captureDownloads();
  });

  afterEach(() => downloads.restore());

  it("saves the blob under the given name", async () => {
    downloadBlob(new Blob(["hello"], { type: "text/plain" }), "hello.txt");

    expect([...(await downloads.bytes())]).toEqual([...new TextEncoder().encode("hello")]);
    expect(downloads.links()[0].download).toBe("hello.txt");
  });

  it("saves an empty blob on purpose", () => {
    downloadBlob(new Blob([]), "empty.txt");

    expect(downloads.blobs).toHaveLength(1);
    expect(downloads.blobs[0].size).toBe(0);
  });

  it.each([undefined, null, "text", { data: "abc" }])(
    "refuses %s instead of downloading it",
    (content) => {
      expect(() => downloadBlob(content, "file.txt")).toThrow(
        "Nothing to download",
      );
      expect(downloads.blobs).toEqual([]);
      expect(downloads.links()).toEqual([]);
    },
  );
});

describe("downloadText", () => {
  let downloads;

  beforeEach(() => {
    downloads = captureDownloads();
  });

  afterEach(() => downloads.restore());

  it("sets the content type of a text download", () => {
    downloadText("{\"a\":1}", "application/json", "data.json");

    expect(downloads.blobs[0].type).toBe("application/json");
    expect(downloads.links()[0].download).toBe("data.json");
  });

  it("downloads an svg as an image", async () => {
    downloadSvg("<svg />", "diagram.svg");

    expect(downloads.blobs[0].type).toBe("image/svg+xml;charset=utf-8");
    expect([...(await downloads.bytes())]).toEqual([
      ...new TextEncoder().encode("<svg />"),
    ]);
  });
});

describe("renderedFilename", () => {
  it("stamps the current time into the name", () => {
    expect(renderedFilename("chart", "png")).toMatch(
      /^chart-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/,
    );
  });
});
