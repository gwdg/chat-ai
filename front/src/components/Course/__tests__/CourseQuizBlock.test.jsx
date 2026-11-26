import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureCourse } = vi.hoisted(() => ({ ensureCourse: vi.fn() }));
vi.mock("../../../utils/courseCatalog", () => ({ ensureCourse }));

import i18n from "../../../i18n";
import CourseQuizBlock from "../../../config/branding/gaia/features/course-material/CourseQuizBlock";
import { AssistantMessageContext } from "../../Conversation/MessageAssistant/AssistantMessageContext";

const course = {
  id: "c-programmierung",
  title: "C-Programmierung",
  questions: [
    {
      id: "question-1",
      type: "single_choice",
      question: "Which answer is correct?",
      answers: ["Wrong", "Right"],
      correct: [1],
      skills: [],
      tags: [],
      status: "draft",
      explanation: "Option two is the correct one.",
    },
  ],
};

const renderBlock = (source, assistant = null) => {
  const block = <CourseQuizBlock source={source} />;
  return render(
    <MemoryRouter>
      {assistant ? (
        <AssistantMessageContext.Provider value={assistant}>
          {block}
        </AssistantMessageContext.Provider>
      ) : (
        block
      )}
    </MemoryRouter>,
  );
};

beforeEach(async () => {
  await i18n.changeLanguage("en");
  ensureCourse.mockReset();
  ensureCourse.mockResolvedValue(course);
});

describe("CourseQuizBlock", () => {
  it("loads the question from the course and grades it in place", async () => {
    renderBlock('{"course":"c-programmierung","id":"question-1"}');

    expect(await screen.findByText("Which answer is correct?")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(ensureCourse).toHaveBeenCalledWith("c-programmierung");

    fireEvent.click(screen.getByLabelText("Right"));
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByText("Option two is the correct one.")).toBeInTheDocument();
  });

  it("shows a broken-block line for malformed input", async () => {
    renderBlock("not json");
    expect(
      await screen.findByText("This quiz question could not be loaded."),
    ).toBeInTheDocument();
    expect(ensureCourse).not.toHaveBeenCalled();
  });

  it("reports a question that is no longer in the course and links back", async () => {
    renderBlock('{"course":"c-programmierung","id":"gone"}');
    expect(
      await screen.findByText(/no longer part of the course/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open course/i })).toHaveAttribute(
      "href",
      "/course/c-programmierung",
    );
  });

  it("turns a failed course load into a short error line", async () => {
    ensureCourse.mockRejectedValueOnce(new Error("offline"));
    renderBlock('{"course":"c-programmierung","id":"question-1"}');
    await waitFor(() =>
      expect(
        screen.getByText("This quiz question could not be loaded."),
      ).toBeInTheDocument(),
    );
  });

  it("restores the answer the message already kept", async () => {
    const message = {
      id: "m-1",
      meta: {
        quizAnswers: {
          "question-1": { selection: [1], checked: true, text: "" },
        },
      },
    };
    renderBlock('{"course":"c-programmierung","id":"question-1"}', {
      getMessage: () => message,
      setMessageMeta: vi.fn(),
    });

    // No click: the stored answer already shows the grading and explanation.
    expect(
      await screen.findByText("Which answer is correct?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(
      screen.getByText("Option two is the correct one."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Right")).toBeDisabled();
  });

  it("keeps a new answer on the message and drops it again on reset", async () => {
    let message = { id: "m-1", meta: {} };
    renderBlock('{"course":"c-programmierung","id":"question-1"}', {
      getMessage: () => message,
      setMessageMeta: (patch) => {
        const metaPatch =
          typeof patch === "function" ? patch(message.meta) : patch;
        message = { ...message, meta: { ...message.meta, ...metaPatch } };
      },
    });

    expect(
      await screen.findByText("Which answer is correct?"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Right"));
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(message.meta.quizAnswers["question-1"]).toEqual({
      selection: [1],
      checked: true,
      text: "",
    });

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(message.meta.quizAnswers["question-1"]).toBeUndefined();
    expect(screen.getByRole("button", { name: /check/i })).toBeInTheDocument();
  });
});
