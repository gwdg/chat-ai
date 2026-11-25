import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { brandChatToolsFor } = vi.hoisted(() => ({ brandChatToolsFor: vi.fn() }));
vi.mock("../../../utils/brandChatTools", () => ({ brandChatToolsFor }));

const { sendPrompt } = vi.hoisted(() => ({ sendPrompt: vi.fn() }));
vi.mock("../../../utils/promptSend", () => ({ sendPrompt }));

import i18n from "../../../i18n";
import CourseMaterialAsk from "../../../config/branding/gaia/features/course-material/CourseMaterialAsk";

const persona = { courseId: "c-programmierung" };
const localState = {
  id: "chat-1",
  settings: { model: { id: "some-tool-model" } },
  messages: [
    { role: "user", content: [{ type: "text", text: "" }] },
    { role: "assistant", content: [{ type: "text", text: "hi" }] },
  ],
};

const tools = (...names) => ({
  definitions: names.map((name) => ({ type: "function", function: { name } })),
  run: vi.fn(),
});

const renderAsk = (props = {}) =>
  render(
    <CourseMaterialAsk
      persona={persona}
      localState={localState}
      setLocalState={vi.fn()}
      sendMessage={vi.fn()}
      {...props}
    />,
  );

beforeEach(async () => {
  await i18n.changeLanguage("en");
  brandChatToolsFor.mockReset();
  sendPrompt.mockReset();
  brandChatToolsFor.mockReturnValue(
    tools("show_course_quiz", "show_course_page"),
  );
});

describe("CourseMaterialAsk", () => {
  it("names both tools and asks for an example of each", () => {
    renderAsk();

    expect(
      screen.getByText(/quiz question or a learning page from this course/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ask for a quiz question/i }));
    fireEvent.click(screen.getByRole("button", { name: /show a learning page/i }));

    expect(sendPrompt).toHaveBeenCalledTimes(2);
    expect(sendPrompt.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        localState,
        prompt: "Please give me an example quiz question from this course to practise.",
      }),
    );
    expect(sendPrompt.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        localState,
        prompt: "Please show me an example learning page from this course.",
      }),
    );
  });

  it("offers only the tools this chat actually has", () => {
    brandChatToolsFor.mockReturnValue(tools("show_course_page"));
    renderAsk();

    expect(
      screen.queryByRole("button", { name: /ask for a quiz question/i }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /show a learning page/i }),
    ).toBeInTheDocument();
  });

  it("stays hidden when the model cannot use the tools", () => {
    brandChatToolsFor.mockReturnValue(null);
    const { container } = renderAsk();
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden outside a course chat", () => {
    renderAsk({ persona: { title: "Not a course" } });
    expect(
      screen.queryByRole("button", { name: /ask for a quiz question/i }),
    ).not.toBeInTheDocument();
  });

  it("disables both buttons while a turn is running", () => {
    renderAsk({
      localState: {
        ...localState,
        messages: [{ role: "assistant", content: [], loading: true }],
      },
    });
    expect(
      screen.getByRole("button", { name: /ask for a quiz question/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /show a learning page/i }),
    ).toBeDisabled();
  });
});
