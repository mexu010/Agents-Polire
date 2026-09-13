import { describe, it, expect } from "vitest";
import { validate, schemaFor, hash } from "../src/contracts.js";
describe("contract boundary", () => {
  it("rejects forged runtime identifiers in model output", () => {
    expect(() =>
      validate("ScoutOutput", {
        data: null,
        gaps: [],
        notices: [],
        run_id: "forged",
      }),
    ).toThrow();
  });
  it("rejects missing required output fields", () =>
    expect(() => validate("ScoutOutput", { data: null })).toThrow());
  it("selects a strict provider schema root and resolves reachable references", () => {
    const s = schemaFor("ScoutOutput");
    expect(s.type).toBe("object");
    expect(s.additionalProperties).toBe(false);
    expect(s.$defs.ScoutData).toBeDefined();
  });
  it("hashes equivalent objects consistently", () =>
    expect(hash({ b: 2, a: 1 })).toBe(hash({ a: 1, b: 2 })));
});
