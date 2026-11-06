import DOMPurify from "dompurify";
import { describe, expect, it } from "vitest";
import { isExternalUrl, sanitizeExternalRefs } from "../externalRefs";

describe("external reference policy", () => {
  it("classifies URLs", () => {
    expect(isExternalUrl("https://example.com/a.png")).toBe(true);
    expect(isExternalUrl("//example.com/a.png")).toBe(true);
    expect(isExternalUrl("/local/a.png")).toBe(false);
    expect(isExternalUrl("#section")).toBe(false);
    expect(isExternalUrl("data:image/png;base64,abc")).toBe(false);
    expect(isExternalUrl("mailto:a@example.com")).toBe(false);
  });

  it("removes external refs when loading is disabled", () => {
    const html = sanitizeExternalRefs(false, () =>
      DOMPurify.sanitize(
        '<img src="https://evil.example/x.png" alt="x"><a href="/safe">safe</a>',
        { ADD_ATTR: ["target"] },
      ),
    );
    expect(html).not.toContain("https://evil.example");
    expect(html).toContain('href="/safe"');
  });

  it("keeps external refs when loading is enabled", () => {
    const html = sanitizeExternalRefs(true, () =>
      DOMPurify.sanitize('<img src="https://example.com/x.png" alt="x">'),
    );
    expect(html).toContain("https://example.com/x.png");
  });
});
