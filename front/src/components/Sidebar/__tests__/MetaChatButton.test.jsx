import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/Sidebar/SidebarContent.tsx"),
  "utf8",
);

const metaRow = () => {
  const start = source.indexOf('isFeatureEnabled("meta_chat")');
  const anchor = source.indexOf('data-guide="meta-chat"', start);
  expect(start).toBeGreaterThan(-1);
  expect(anchor).toBeGreaterThan(start);
  return source.slice(start, source.indexOf("</Tooltip>", anchor));
};

describe("sidebar Help/Meta chat row", () => {
  it("is the size of a section band", () => {
    const row = metaRow();

    expect(row).toContain('className="px-1 pb-1"');
    expect(row).toMatch(/className={`flex min-h-8 w-full/);
  });

  it("starts its glyph where the New Chat plus starts", () => {
    const row = metaRow();

    expect(row).toContain("pl-4 pr-1.5");
    expect(source).toContain(
      'className="flex items-center justify-between gap-1 px-3 pb-0"',
    );
  });

  it("keeps its own style", () => {
    const row = metaRow();

    expect(row).toContain("gap-1.5 rounded-lg py-1");
    expect(row).toContain("text-left text-xs");
    expect(row).toContain("hover:bg-base-200 hover:text-base-content");
    expect(row).toContain("<ChattyLogo");
  });
});
