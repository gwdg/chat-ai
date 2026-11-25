import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AgentFormCard from "../AgentFormCard";

describe("AgentFormCard option fields", () => {
  it("renders multiple select options as a vertical checkbox list", () => {
    const onReply = vi.fn();
    const form = {
      id: "form-1",
      title: "Choose colours",
      fields: [
        {
          key: "colours",
          title: "Colours",
          type: "select",
          multiple: true,
          options: [
            { value: "red", label: "Red" },
            { value: "blue", label: "Blue" },
          ],
        },
      ],
    };

    render(<AgentFormCard form={form} onReply={onReply} />);

    expect(screen.getByRole("checkbox", { name: "Red" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Blue" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Blue" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onReply).toHaveBeenCalledWith(form, { colours: ["blue"] });
  });

  it("renders a single select as a radio list", () => {
    const form = {
      id: "form-2",
      title: "Choose a size",
      fields: [
        {
          key: "size",
          title: "Size",
          type: "select",
          options: [
            { value: "small", label: "Small" },
            { value: "large", label: "Large" },
          ],
        },
      ],
    };

    render(<AgentFormCard form={form} onReply={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Small" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Large" })).toBeInTheDocument();
  });

  it("renders OpenCode question fields with text and option descriptions", () => {
    const onReply = vi.fn();
    const form = {
      id: "form-question",
      title: "Questions",
      fields: [
        {
          key: "q0",
          title: "Markdown regeneration",
          description: "What should I do with the generated Markdown?",
          type: "string",
          custom: true,
          options: [
            {
              value: "Rebuild",
              label: "Rebuild from sources",
              description: "Reads the LaTeX sources again.",
            },
            {
              value: "Leave",
              label: "Leave it as is",
              description: "Change nothing.",
            },
          ],
        },
      ],
    };

    render(<AgentFormCard form={form} onReply={onReply} />);

    expect(screen.getByText("Markdown regeneration")).toBeInTheDocument();
    expect(
      screen.getByText("What should I do with the generated Markdown?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Reads the LaTeX sources again.")).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Rebuild from sources/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Leave it as is/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onReply).toHaveBeenCalledWith(form, { q0: "Leave" });
  });

  it("submits a typed custom answer instead of a selected option", () => {
    const onReply = vi.fn();
    const form = {
      id: "form-custom",
      title: "Questions",
      fields: [
        {
          key: "q0",
          title: "Markdown regeneration",
          type: "string",
          custom: true,
          options: [{ value: "Rebuild", label: "Rebuild from sources" }],
        },
      ],
    };

    render(<AgentFormCard form={form} onReply={onReply} />);

    fireEvent.click(
      screen.getByRole("radio", { name: /Rebuild from sources/ }),
    );
    fireEvent.change(screen.getByPlaceholderText("Type your own answer"), {
      target: { value: "Do both, then compare" },
    });
    expect(
      screen.getByRole("radio", { name: /Rebuild from sources/ }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onReply).toHaveBeenCalledWith(form, {
      q0: "Do both, then compare",
    });
  });

  it("combines selected options and a custom answer for multiselect", () => {
    const onReply = vi.fn();
    const form = {
      id: "form-multi-custom",
      title: "Questions",
      fields: [
        {
          key: "q0",
          title: "Which files?",
          type: "multiselect",
          custom: true,
          options: [
            { value: "slides", label: "Slides" },
            { value: "exercises", label: "Exercises" },
          ],
        },
      ],
    };

    render(<AgentFormCard form={form} onReply={onReply} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Slides" }));
    fireEvent.change(screen.getByPlaceholderText("Type your own answer"), {
      target: { value: "Summary" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(onReply).toHaveBeenCalledWith(form, {
      q0: ["slides", "Summary"],
    });
  });
});
