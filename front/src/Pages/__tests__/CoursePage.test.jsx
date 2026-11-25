import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import i18n from "../../i18n";
import {
  buildCourseStats,
  parseQuizDocument,
  parseSkillsDocument,
} from "../../utils/gaiaContent";

const mocks = vi.hoisted(() => ({
  importConversation: vi.fn().mockResolvedValue(undefined),
  loadCourse: vi.fn(),
  loadCourseDocument: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ courseId: "c" }) };
});

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));

vi.mock("../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: { name: "Chat AI" } }),
}));

vi.mock("../../hooks/useImportConversation", () => ({
  useImportConversation: () => mocks.importConversation,
}));

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }),
}));

vi.mock("../../utils/courseCatalog", () => ({
  loadCourse: mocks.loadCourse,
  loadCourseDocument: mocks.loadCourseDocument,
}));

import CoursePage from "../CoursePage";

const skillsDoc = parseSkillsDocument({
  topics: [{ key: "intro", name: "Intro", description: "Basics" }],
  skills: [
    {
      key: "hello_world",
      topic_key: "intro",
      name: "Hello world",
      description: "Write your first program.",
      prerequisites: [],
    },
  ],
});

const quizDoc = parseQuizDocument({
  questions: [
    {
      type: "single_choice",
      question: "Which answer is correct?",
      answers: ["Wrong", "Right"],
      correct: [2],
      skills: ["hello_world"],
    },
  ],
});

const lernseiten = [
  {
    skill: "hello_world",
    file: "lernseiten/page.html",
    url: "https://raw.example/page.html",
    title: "Page one",
  },
];

const course = {
  id: "c",
  title: "C-Programmierung",
  subtitle: "Skills and quiz",
  personaPath: "courses/c.json",
  personaUrl: "https://raw.example/courses/c.json",
  persona: {
    title: "C-Programmierung",
    messages: [{ role: "system", content: "Tutor" }],
  },
  entry: { category: "courses" },
  baseUrl: "https://raw.example/courses/c/",
  skillsDoc,
  quizDoc,
  questions: quizDoc.questions,
  groups: skillsDoc.groups,
  overviews: {
    skills: "https://raw.example/courses/c/skills.html",
    quiz: "https://raw.example/courses/c/quiz.html",
  },
  lernseiten,
  stats: buildCourseStats({ skillsDoc, quizDoc, lernseiten }),
};

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mocks.importConversation.mockClear();
  mocks.loadCourse.mockReset();
  mocks.loadCourse.mockResolvedValue(course);
  mocks.loadCourseDocument.mockReset();
  mocks.loadCourseDocument.mockResolvedValue("<html>overview</html>");
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CoursePage />
    </MemoryRouter>,
  );

describe("CoursePage", () => {
  it("loads the course and lists its skills and statistics", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "C-Programmierung" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("1 topics")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Quiz" }));

    expect(screen.getByText("Which answer is correct?")).toBeInTheDocument();
  });

  it("starts the course chat with the course persona", async () => {
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "C-Programmierung" });
    fireEvent.click(
      screen.getByRole("button", { name: /start course chat/i }),
    );

    await waitFor(() => expect(mocks.importConversation).toHaveBeenCalled());
    const [persona, inline, topicId, options] =
      mocks.importConversation.mock.calls[0];
    expect(persona.messages[0].role).toBe("system");
    expect(inline).toBe(false);
    expect(topicId).toBeNull();
    expect(options.persona).toMatchObject({
      title: "C-Programmierung",
      courseId: "c",
    });
  });

  it("shows the review coverage and loads the generated overview", async () => {
    renderPage();

    await screen.findByRole("heading", { level: 1, name: "C-Programmierung" });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByText("Coverage")).toBeInTheDocument();
    expect(mocks.loadCourseDocument).toHaveBeenCalledWith(
      "https://raw.example/courses/c/skills.html",
    );
  });

  it("offers a retry when the course cannot be loaded", async () => {
    mocks.loadCourse.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(
      await screen.findByText("The course could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
