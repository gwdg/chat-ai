import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MetaBox from "../MetaBox";

describe("MetaBox", () => {
  it("shows token usage and cost when the model provides it", () => {
    render(
      <MetaBox
        meta={{
          model: "Test model",
          usage: {
            prompt_tokens: 12,
            completion_tokens: 3,
            cost: 0.0042,
          },
        }}
      />
    );

    expect(screen.getByText(/12 \+ 3 tokens/)).toBeInTheDocument();
    expect(screen.getByText(/0\.0042 cost/)).toBeInTheDocument();
  });

  it("omits cost when the model does not provide a number", () => {
    render(
      <MetaBox
        meta={{
          model: "Test model",
          usage: { prompt_tokens: 12, completion_tokens: 3 },
        }}
      />
    );

    expect(screen.queryByText(/cost/)).not.toBeInTheDocument();
  });
});
