import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureCourse, loadCourseDocument } = vi.hoisted(() => ({
  ensureCourse: vi.fn(),
  loadCourseDocument: vi.fn(),
}));
vi.mock("../../../../utils/courseCatalog", () => ({
  ensureCourse,
  loadCourseDocument,
}));
// The fallback path renders the block as a highlighted code fence, which is
// TypstBlock; it reads only boolean render preferences, so a bare selector stub
// is enough and keeps this test free of the app store.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));

import { SafeMarkdown } from "../MarkdownRenderer";
import { clearBrandFeatureCache } from "../../../../config/brandFeatures";
import { getBrandProfile, setCurrentBrand } from "../../../../config/brands";

const course = {
  id: "c-programmierung",
  title: "C-Programmierung",
  questions: [
    {
      id: "question-75",
      type: "single_choice",
      question: "Which answer is correct?",
      answers: ["Wrong", "Right"],
      correct: [1],
      skills: [],
      tags: [],
      status: "draft",
      explanation: "",
    },
  ],
  lernseiten: [
    {
      skill: "",
      file: "lernseiten/pointers.html",
      url: "/courses/c-programmierung/lernseiten/pointers.html",
      title: "Pointers step by step",
    },
  ],
};

beforeEach(() => {
  ensureCourse.mockReset();
  ensureCourse.mockResolvedValue(course);
  loadCourseDocument.mockReset();
  loadCourseDocument.mockResolvedValue("<html><body>page</body></html>");
});

describe("gaia-quiz fence in a message", () => {
  it("renders the card for the active GAIA brand", async () => {
    setCurrentBrand(getBrandProfile("gaia"));
    clearBrandFeatureCache();
    try {
      render(
        <MemoryRouter>
          <SafeMarkdown>
            {'Here you go:\n\n```gaia-quiz\n{"course":"c-programmierung","id":"question-75"}\n```'}
          </SafeMarkdown>
        </MemoryRouter>,
      );
      expect(
        await screen.findByText("Which answer is correct?"),
      ).toBeInTheDocument();
    } finally {
      setCurrentBrand(null);
      clearBrandFeatureCache();
    }
  });

  it("renders an embedded learning page for the active GAIA brand", async () => {
    setCurrentBrand(getBrandProfile("gaia"));
    clearBrandFeatureCache();
    try {
      render(
        <MemoryRouter>
          <SafeMarkdown>
            {'Here is a page:\n\n```gaia-page\n{"course":"c-programmierung","page":"lernseiten/pointers.html"}\n```'}
          </SafeMarkdown>
        </MemoryRouter>,
      );
      expect(
        await screen.findByText("Pointers step by step"),
      ).toBeInTheDocument();
      expect(
        await screen.findByTitle("Pointers step by step"),
      ).toBeInTheDocument();
    } finally {
      setCurrentBrand(null);
      clearBrandFeatureCache();
    }
  });

  it("leaves the raw block as code for a brand without the feature", () => {
    setCurrentBrand(getBrandProfile("chat-ai"));
    clearBrandFeatureCache();
    try {
      const { container } = render(
        <MemoryRouter>
          <SafeMarkdown>
            {'```gaia-quiz\n{"course":"c-programmierung","id":"question-75"}\n```'}
          </SafeMarkdown>
        </MemoryRouter>,
      );
      expect(container.querySelector(".course-quiz-card")).toBeNull();
      expect(container.textContent).toContain("question-75");
    } finally {
      setCurrentBrand(null);
      clearBrandFeatureCache();
    }
  });
});
