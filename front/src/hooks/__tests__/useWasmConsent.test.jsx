import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  grantWasmConsent,
  hasWasmConsent,
  useWasmConsent,
} from "../useWasmConsent";

function ConsentProbe({ feature }) {
  return <span>{useWasmConsent(feature) ? "granted" : "pending"}</span>;
}

describe("wasm consent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("asks again until the feature is confirmed", () => {
    render(<ConsentProbe feature="test-typst" />);
    expect(screen.getByText("pending")).toBeInTheDocument();

    act(() => grantWasmConsent("test-typst"));

    expect(screen.getByText("granted")).toBeInTheDocument();
    expect(hasWasmConsent("test-typst")).toBe(true);
    expect(localStorage.getItem("chatai.wasm-consent.v1.test-typst")).toBe(
      "granted"
    );
  });

  it("remembers confirmation across mounts", () => {
    grantWasmConsent("test-latex");
    render(<ConsentProbe feature="test-latex" />);
    expect(screen.getByText("granted")).toBeInTheDocument();
  });
});
