import { describe, expect, it } from "vitest";
import {
  designFingerprint,
  reviewDesignHistory,
} from "../src/design-policy.js";
const brief = (composition = "editorial", profile = "editorial-spread") => ({
  theme: {
    composition,
    design_profile: profile,
    font_pair: composition === "editorial" ? "editorial" : "sans",
    spacing: "comfortable",
  },
  pages: [
    {
      sections: [
        { component: "hero", asset_id: null },
        { component: "services", asset_id: null },
      ],
    },
  ],
});
describe("portfolio history derived from rendered capabilities", () => {
  it("derives structural features from the supported profile, not model labels", () => {
    const fingerprint = designFingerprint(brief());
    expect(fingerprint.signature.version).toBe(2);
    expect(fingerprint.signature.features.image_strategy).toBe("type-only");
    expect(() => designFingerprint(brief("editorial", "invented"))).toThrow();
  });
  it("warns about older repeats while identifying legacy comparison gaps", () => {
    const current = designFingerprint(brief());
    const different = designFingerprint(brief("minimal", "service-index"));
    const report = reviewDesignHistory(brief(), [
      different,
      current,
      { composition: "bold", font_pair: "sans", section_order: ["hero"] },
    ]);
    expect(report.warnings.some((item: any) => item.history_index === 1)).toBe(
      true,
    );
    expect(report.compared_count).toBe(2);
    expect(report.gaps).toHaveLength(1);
    expect(reviewDesignHistory(brief(), []).compared_count).toBe(0);
  });
  it("reviews up to eight histories and rejects inconsistent stored signatures", () => {
    const current = designFingerprint(brief());
    const different = designFingerprint(brief("minimal", "service-index"));
    const history = Array.from({ length: 9 }, (_, index) =>
      index === 7 ? current : different,
    );
    const report = reviewDesignHistory(brief(), history);
    expect(report.available_count).toBe(8);
    expect(report.compared_count).toBe(8);
    expect(report.warnings.some((item: any) => item.history_index === 7)).toBe(
      true,
    );
    expect(report.warnings.some((item: any) => item.history_index === 8)).toBe(
      false,
    );

    const inconsistent = structuredClone(current);
    inconsistent.composition = "bold";
    const inconsistentReport = reviewDesignHistory(brief(), [inconsistent]);
    expect(inconsistentReport.compared_count).toBe(0);
    expect(inconsistentReport.gaps).toHaveLength(1);
  });
});
