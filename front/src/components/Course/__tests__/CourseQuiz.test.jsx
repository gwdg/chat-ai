import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../../../i18n";
import { parseQuizDocument, parseSkillsDocument } from "../../../utils/gaiaContent";
import CourseQuiz from "../CourseQuiz";

const skillsDoc = parseSkillsDocument({
  topics: [
    { key: "intro", name: "Intro" },
    { key: "functions", name: "Functions" },
  ],
  skills: [
    { key: "hello_world", topic_key: "intro", name: "Hello world" },
    { key: "call_by_value", topic_key: "functions", name: "Call by value" },
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
      explanation: "Option two is the correct one.",
    },
    {
      type: "open_end",
      question: "Explain call by value.",
      answers: ["The parameter receives a copy."],
      skills: ["call_by_value"],
    },
  ],
});

const course = {
  skillsDoc,
  quizDoc,
  questions: quizDoc.questions,
};

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("CourseQuiz", () => {
  it("grades a single-choice answer locally", () => {
    render(<CourseQuiz course={course} />);

    fireEvent.click(screen.getByLabelText("Right"));
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(screen.getByText("Correct.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("marks a wrong answer and keeps the correct one visible", () => {
    render(<CourseQuiz course={course} />);

    fireEvent.click(screen.getByLabelText("Wrong"));
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(screen.getByText("Not correct yet.")).toBeInTheDocument();
  });

  it("shows the explanation after checking a question that has one", () => {
    render(<CourseQuiz course={course} />);

    fireEvent.click(screen.getByLabelText("Right"));
    fireEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(screen.getByText("Explanation")).toBeInTheDocument();
    expect(
      screen.getByText("Option two is the correct one."),
    ).toBeInTheDocument();
  });

  it("shows the sample answer for an open question", () => {
    render(<CourseQuiz course={course} initialSkill="call_by_value" />);

    expect(screen.getByText("Explain call by value.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show solution/i }));

    expect(
      screen.getByText("The parameter receives a copy."),
    ).toBeInTheDocument();
  });

  it("filters the questions by skill and resets to the first one", () => {
    render(<CourseQuiz course={course} initialSkill="call_by_value" />);

    expect(screen.getByText("Explain call by value.")).toBeInTheDocument();
    expect(
      screen.queryByText("Which answer is correct?"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "" },
    });

    expect(screen.getByText("Which answer is correct?")).toBeInTheDocument();
  });
});
