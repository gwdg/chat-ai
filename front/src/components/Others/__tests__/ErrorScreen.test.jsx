import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorScreen from "../ErrorScreen";

describe("ErrorScreen", () => {
  it("shows the message and details and invokes the reload handler", () => {
    const onReload = vi.fn();
    render(
      <ErrorScreen
        title="Local database unavailable"
        message="Close the other tabs."
        details="VersionError: newer schema"
        reloadLabel="Reload"
        onReload={onReload}
      />,
    );

    expect(screen.getByText("Local database unavailable")).toBeInTheDocument();
    expect(screen.getByText("Close the other tabs.")).toBeInTheDocument();
    expect(screen.getByText("VersionError: newer schema")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("hides the details section when there are no details", () => {
    render(
      <ErrorScreen
        title="Something went wrong"
        message="Try again."
        reloadLabel="Reload"
        onReload={vi.fn()}
      />,
    );

    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });
});
