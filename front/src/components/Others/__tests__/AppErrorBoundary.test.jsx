import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import AppErrorBoundary from "../AppErrorBoundary";

function Boom() {
  throw new Error("render exploded");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppErrorBoundary", () => {
  it("renders the error screen instead of a blank page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(screen.getByText(i18n.t("errors.app_title"))).toBeInTheDocument();
    expect(screen.getByText(/render exploded/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("errors.reload") }),
    ).toBeInTheDocument();
  });

  it("renders its children when nothing throws", () => {
    render(
      <AppErrorBoundary>
        <span>healthy app</span>
      </AppErrorBoundary>,
    );

    expect(screen.getByText("healthy app")).toBeInTheDocument();
  });
});
