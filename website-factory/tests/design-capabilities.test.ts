import { describe, expect, test } from "vitest";
import {
  DESIGN_CAPABILITIES_VERSION,
  DESIGN_PROFILES,
  resolveDesignProfile,
  validateDesignTheme,
} from "../src/design-capabilities.js";

const theme = {
  palette: "light",
  accent_hex: null,
  spacing: "comfortable",
  motion: "none",
};

describe("renderer design capabilities", () => {
  test("resolves three supported profiles into distinct structural signatures", () => {
    const selections = [
      ["editorial-spread", "editorial", "editorial"],
      ["service-index", "minimal", "sans"],
      ["type-poster", "bold", "sans"],
    ] as const;
    const signatures = new Set<string>();
    for (const [id, composition, font_pair] of selections) {
      const profile = resolveDesignProfile({
        ...theme,
        design_profile: id,
        composition,
        font_pair,
      });
      expect(profile).toEqual(DESIGN_PROFILES[id]);
      signatures.add(
        [
          profile?.hero_arrangement,
          profile?.mobile_arrangement,
          profile?.service_layout,
          profile?.section_rhythm,
          profile?.typography,
          profile?.image_treatment,
        ].join("/"),
      );
    }
    expect(signatures.size).toBe(3);
    expect(DESIGN_CAPABILITIES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("keeps legacy themes without a selected profile", () => {
    expect(
      resolveDesignProfile({
        ...theme,
        composition: "atelier",
        font_pair: "sans",
      }),
    ).toBeNull();
    expect(
      resolveDesignProfile({
        ...theme,
        composition: "atelier",
        font_pair: "sans",
        design_profile: null,
      }),
    ).toBeNull();
  });

  test("rejects unknown IDs and contradictory composition or type pair", () => {
    expect(() =>
      validateDesignTheme({
        ...theme,
        composition: "bold",
        font_pair: "sans",
        design_profile: "future-layout",
      }),
    ).toThrow(/design.profile|unknown/i);
    expect(() =>
      validateDesignTheme({
        ...theme,
        composition: "bold",
        font_pair: "editorial",
        design_profile: "type-poster",
      }),
    ).toThrow(/font_pair/i);
    expect(() =>
      validateDesignTheme({
        ...theme,
        composition: "atelier",
        font_pair: "sans",
        design_profile: "type-poster",
      }),
    ).toThrow(/composition/i);
    expect(() =>
      validateDesignTheme({
        ...theme,
        font_pair: "sans",
        design_profile: "type-poster",
      }),
    ).toThrow(/composition/i);
  });
});
