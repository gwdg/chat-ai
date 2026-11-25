import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import ModelSelectorExtended from "../ModelSelectorExtended";

// The selector shows the E2EE lock from the user settings, so it needs a store.
const store = configureStore({
  reducer: (state = { user_settings: { e2ee_keys: [], e2ee_models: {} } }) =>
    state,
});

const model = {
  id: "alpha",
  name: "Alpha Mock Model",
  input: [],
  output: [],
  company: "GWDG",
  contextLength: "128000",
  releaseDate: "2026-01-01",
  demand: "low",
  status: "online",
};

const renderSelector = (inHeader) =>
  render(
    <Provider store={store}>
      <ModelSelectorExtended
        selectedModel={model}
        modelsData={[model]}
        inHeader={inHeader}
        onChange={() => {}}
      />
    </Provider>
  );

describe("ModelSelectorExtended header trigger", () => {
  it("fits inside the 56 px mobile header", () => {
    renderSelector(true);

    const trigger = screen.getByRole("button", { name: /Alpha Mock Model/ });
    expect(trigger.className).toContain("h-11");
    expect(trigger.className).not.toContain("min-h-[4rem]");
  });

  it("keeps the taller trigger in the prompt box", () => {
    renderSelector(false);

    const trigger = screen.getByRole("button", { name: /Alpha Mock Model/ });
    expect(trigger.className).toContain("min-h-[4rem]");
  });
});
