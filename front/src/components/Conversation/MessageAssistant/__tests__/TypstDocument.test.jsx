import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TypstRendered } from "../TypstDocument";

// A rendered document is cropped SVG in a shadow root; jsdom has no layout, so
// the crop is a no-op and the zoom rule in that shadow root is what these tests
// look at. The compiler, consent and cache belong to `useTypstDocument`.
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
  '<rect width="10" height="10" /></svg>';

const shadowStyle = () =>
  document.querySelector(".typst-document").shadowRoot.innerHTML;

describe("TypstRendered", () => {
  it("offers no zoom bar to a host that did not ask for one", () => {
    render(<TypstRendered svg={SVG} />);

    expect(
      screen.queryByRole("button", { name: "Zoom in" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("typst-zoom-content")).toBeInTheDocument();
    // At 100 % the document keeps its own size and is only capped to the pane.
    expect(shadowStyle()).toContain("max-width:100%");
  });

  it("zooms the rendered document and resets it", () => {
    render(<TypstRendered svg={SVG} zoomable />);

    expect(shadowStyle()).toContain("max-width:100%");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    // The SVG grows to the factor instead of a transform painting outside it,
    // so the enclosing pane becomes scrollable to the whole document.
    expect(shadowStyle()).toContain("width:150%");
    expect(shadowStyle()).not.toContain("max-width:100%");
    expect(
      screen.getByRole("button", { name: "Reset zoom to 100%" }),
    ).toHaveTextContent("150%");

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(shadowStyle()).toContain("width:125%");

    fireEvent.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));
    expect(shadowStyle()).toContain("max-width:100%");
    expect(
      screen.getByRole("button", { name: "Reset zoom to 100%" }),
    ).toHaveTextContent("100%");
  });
});
