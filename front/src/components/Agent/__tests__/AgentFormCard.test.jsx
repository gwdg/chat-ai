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
});
