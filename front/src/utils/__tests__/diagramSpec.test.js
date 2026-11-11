import { describe, expect, it } from "vitest";
import { detectJsonDiagram } from "../diagramSpec";

describe("detectJsonDiagram", () => {
  it("detects Vega-Lite and Vega schemas", () => {
    expect(detectJsonDiagram('{"$schema":"https://vega.github.io/schema/vega-lite/v6.json","mark":"bar"}')).toEqual({
      type: "vega",
      language: "vega-lite",
    });
    expect(detectJsonDiagram('{"$schema":"https://vega.github.io/schema/vega/v6.json","marks":[]}')).toEqual({
      type: "vega",
      language: "vega",
    });
  });

  it("detects Vega-Lite specs without a schema", () => {
    expect(detectJsonDiagram('{"data":{"values":[]},"mark":"bar"}')).toEqual({
      type: "vega",
      language: "vega-lite",
    });
  });

  it("detects Chart.js configs", () => {
    expect(detectJsonDiagram('{"type":"bar","data":{"datasets":[]}}')).toEqual({
      type: "chartjs",
      language: "chartjs",
    });
  });

  it("leaves ordinary JSON alone", () => {
    expect(detectJsonDiagram('{"name":"value","items":[1,2]}')).toBeNull();
    expect(detectJsonDiagram("not json")).toBeNull();
  });
});
