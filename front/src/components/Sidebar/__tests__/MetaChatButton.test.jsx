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

  it("keeps its own style", () => {
    const row = metaRow();

    expect(row).toContain("rounded-lg px-1.5 py-1 text-left text-xs");
    expect(row).toContain("hover:bg-base-200 hover:text-base-content");
    expect(row).toContain("<ChattyLogo");
  });
});
