import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureCourse, loadCourseDocument } = vi.hoisted(() => ({
  ensureCourse: vi.fn(),
  loadCourseDocument: vi.fn(),
}));
vi.mock("../../../utils/courseCatalog", () => ({
  ensureCourse,
  loadCourseDocument,
}));
// The preview needs the app store; the block only hands it the page's HTML.
vi.mock("../../Others/SandboxedHtmlPreview", () => ({
  default: ({ content, title, heightClass }) => (
    <div data-testid="sandbox" data-height={heightClass}>
      {title}:{content}
    </div>
  ),
}));

import i18n from "../../../i18n";
import CoursePageBlock from "../../../config/branding/gaia/features/course-material/CoursePageBlock";

const course = {
  id: "c-programmierung",
  title: "C-Programmierung",
  skillsDoc: { skills: [{ key: "pointers", name: "Pointers" }] },
  lernseiten: [
    {
      skill: "pointers",
      file: "lernseiten/pointers.html",
      url: "/courses/c-programmierung/lernseiten/pointers.html",
      title: "Pointers step by step",
    },
  ],
};

const renderBlock = (source) => render(<CoursePageBlock source={source} />);

beforeEach(async () => {
  await i18n.changeLanguage("en");
  ensureCourse.mockReset();
  loadCourseDocument.mockReset();
  ensureCourse.mockResolvedValue(course);
  loadCourseDocument.mockResolvedValue("<html><body>page</body></html>");
});

describe("CoursePageBlock", () => {
  it("loads the page from the course and embeds it", async () => {
    renderBlock('{"course":"c-programmierung","page":"lernseiten/pointers.html"}');

    expect(await screen.findByText("Pointers step by step")).toBeInTheDocument();
    expect(await screen.findByTestId("sandbox")).toHaveTextContent(
      "page",
    );
    expect(ensureCourse).toHaveBeenCalledWith("c-programmierung");
    expect(loadCourseDocument).toHaveBeenCalledWith(
      "/courses/c-programmierung/lernseiten/pointers.html",
    );
  });

  it("accepts a bare file name from the model", async () => {
    renderBlock('{"course":"c-programmierung","page":"pointers.html"}');
    expect(await screen.findByTestId("sandbox")).toBeInTheDocument();
  });

  it("says so when the page is no longer part of the course", async () => {
    renderBlock('{"course":"c-programmierung","page":"lernseiten/gone.html"}');
    expect(
      await screen.findByText(/no longer part of the course/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("sandbox")).toBeNull();
  });

  it("shows a plain error for a malformed block instead of rendering HTML", () => {
    renderBlock("not json");
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByTestId("sandbox")).toBeNull();
  });

  it("ignores model-supplied HTML in the payload", async () => {
    // `html` is not part of the protocol: the block still loads the course page.
    renderBlock('{"course":"c-programmierung","page":"pointers.html","html":"<p>made up</p>"}');
    expect(await screen.findByTestId("sandbox")).not.toHaveTextContent("made up");
  });

  it("offers a retry when the page cannot be fetched", async () => {
    loadCourseDocument.mockRejectedValueOnce(new Error("offline"));
    renderBlock('{"course":"c-programmierung","page":"lernseiten/pointers.html"}');

    expect(
      await screen.findByText("This learning page could not be loaded."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByTestId("sandbox")).toBeInTheDocument();
  });
});
