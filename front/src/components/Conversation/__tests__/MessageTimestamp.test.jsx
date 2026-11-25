import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { showTimestamps: false };

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: { show_timestamps: state.showTimestamps } }),
}));

import MessageTimestamp from "../MessageTimestamp";

const message = {
  createdAt: new Date("2026-06-15T12:34:00Z").getTime(),
};

describe("MessageTimestamp", () => {
  beforeEach(() => {
    state.showTimestamps = false;
  });

  it("renders nothing while timestamps are disabled", () => {
    const { container } = render(<MessageTimestamp message={message} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message time when enabled", () => {
    state.showTimestamps = true;
    render(<MessageTimestamp message={message} />);

    const time = screen.getByText(/2026/);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2026-06-15T12:34:00.000Z");
  });

  it("renders nothing for messages without a timestamp", () => {
    state.showTimestamps = true;
    const { container } = render(<MessageTimestamp message={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
