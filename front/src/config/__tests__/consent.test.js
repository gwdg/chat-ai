import { describe, expect, it } from "vitest";

import {
  brandConsentGate,
  consentPurposes,
  consentText,
  defaultConsentAnswers,
  requiresBrandConsent,
} from "../consent";

const gate = {
  version: "2026-02",
  purposes: [
    { id: "surveys", label: { en: "Surveys", de: "Umfragen" } },
    { id: "logging", label: "Logging" },
    // Ignored: no usable id.
    { id: "", label: "Broken" },
    { label: "Also broken" },
  ],
};

describe("brand consent helpers", () => {
  it("returns the gate only when the brand declares one", () => {
    expect(brandConsentGate({ consentGate: gate })).toBe(gate);
    // Arrays and primitives never count as a gate.
    expect(brandConsentGate({ consentGate: [] })).toBeNull();
    expect(brandConsentGate({ consentGate: true })).toBeNull();
    expect(brandConsentGate({})).toBeNull();
    expect(brandConsentGate(null)).toBeNull();
  });

  it("keeps the purposes that have an id", () => {
    expect(consentPurposes(gate).map((purpose) => purpose.id)).toEqual([
      "surveys",
      "logging",
    ]);
    expect(consentPurposes(null)).toEqual([]);
  });

  it("defaults every purpose to off", () => {
    expect(defaultConsentAnswers(gate)).toEqual({
      surveys: false,
      logging: false,
    });
  });

  it("requires acceptance until a matching version is recorded", () => {
    const brand = { consentGate: gate };
    expect(requiresBrandConsent(brand, null)).toBe(true);
    expect(requiresBrandConsent(brand, { version: "2026-01" })).toBe(true);
    expect(requiresBrandConsent(brand, { version: "2026-02" })).toBe(false);
    // The stored version is compared as a string, so a number still matches.
    expect(
      requiresBrandConsent({ consentGate: { ...gate, version: 3 } }, { version: "3" }),
    ).toBe(false);
  });

  it("requires nothing when the brand has no gate", () => {
    expect(requiresBrandConsent({}, null)).toBe(false);
    expect(requiresBrandConsent({}, { version: "1" })).toBe(false);
  });

  it("localizes a brand text value", () => {
    expect(consentText({ en: "Terms", de: "Bedingungen" }, "de-DE")).toBe(
      "Bedingungen",
    );
    expect(consentText({ en: "Terms" }, "de")).toBe("Terms");
    expect(consentText("plain", "de")).toBe("plain");
  });
});
