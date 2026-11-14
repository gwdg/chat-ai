import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ToolForm from "../ToolForm";

const mocks = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("../../../../hooks/useSendMessage", () => ({
  useSendMessage: () => (...args) => mocks.sendMessage(...args),
}));

const form = {
  tool_id: "demo_tool",
  title: "Demo form",
  fields: [
    {
      name: "colour",
      label: "Favourite colour",
      type: "select",
      value: "teal",
      options: [
        { value: "teal", label: "Teal" },
        { value: "magenta", label: "Magenta" },
      ],
    },
    {
      name: "reminder",
      label: "Send me a reminder",
      type: "checkbox",
      value: false,
    },
    {
      name: "answer",
      label: "Add text answer",
      type: "textarea",
      placeholder: "Anything else?",
      value: "",
    },
  ],
};

describe("ToolForm", () => {
  it("renders the fields with their default values", () => {
    render(<ToolForm form={form} />);

    expect(screen.getByText("Demo form")).toBeInTheDocument();
    expect(screen.getByLabelText("Favourite colour")).toHaveValue("teal");
    expect(screen.getByLabelText("Send me a reminder")).not.toBeChecked();
    expect(screen.getByLabelText("Add text answer")).toHaveValue("");
  });

  it("hands the edited values to onSubmit instead of sending a message", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ToolForm form={form} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Add text answer"), {
      target: { value: "Hello there" },
    });
    fireEvent.click(
      screen.getByLabelText("Send me a reminder"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      tool_id: "demo_tool",
      values: { colour: "teal", reminder: true, answer: "Hello there" },
    });
    expect(mocks.sendMessage).not.toHaveBeenCalled();

    // The form collapses into the tool-call summary with the submitted values.
    expect(await screen.findByText("Hello there")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("submits through the chat when no onSubmit is given", async () => {
    render(
      <ToolForm
        form={form}
        localState={{ settings: {} }}
        setLocalState={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Add text answer"), {
      target: { value: "From chat" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() => expect(mocks.sendMessage).toHaveBeenCalledTimes(1));
    expect(mocks.sendMessage.mock.calls[0][0].formSubmission).toEqual({
      tool_id: "demo_tool",
      values: { colour: "teal", reminder: false, answer: "From chat" },
    });
  });

  it("resets the fields to their defaults", () => {
    render(<ToolForm form={form} />);

    fireEvent.change(screen.getByLabelText("Add text answer"), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByLabelText("Add text answer")).toHaveValue("");
  });
});
