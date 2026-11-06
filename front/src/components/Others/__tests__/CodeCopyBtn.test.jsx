import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CodeCopyBtn from "../CodeCopyBtn";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CodeCopyBtn", () => {
  it("downloads code with the language extension", () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { container } = render(
      <CodeCopyBtn hovered language="python">
        print("hello")
      </CodeCopyBtn>,
    );

    fireEvent.click(container.querySelectorAll("svg")[0]);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("copies code to the clipboard", () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { container } = render(
      <CodeCopyBtn hovered language="javascript">
        console.log(1)
      </CodeCopyBtn>,
    );

    fireEvent.click(container.querySelectorAll("svg")[1]);
    expect(writeText).toHaveBeenCalledWith("console.log(1)");
  });
});
