import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ToolFormDemoPage from "../ToolFormDemoPage";

vi.mock("../../hooks/useSendMessage", () => ({
  useSendMessage: () => vi.fn(),
}));

describe("ToolFormDemoPage", () => {
  it("shows the demo form and its submitted values", async () => {
    render(<ToolFormDemoPage />);

    expect(
      screen.getByRole("heading", { name: "Tool form test" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Add text answer")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Add text answer"), {
      target: { value: "Hello from the demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run tool" }));

    await waitFor(() =>
      expect(screen.getByText("Submitted values")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Hello from the demo/, { selector: "pre" }),
    ).toBeInTheDocument();
  });
});
