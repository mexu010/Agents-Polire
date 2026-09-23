import type { JsonObject } from "./contracts.js";

export const DESIGN_CAPABILITIES_VERSION = "1.0.0";

export type DesignProfileId =
  "editorial-spread" | "service-index" | "type-poster";

export interface DesignProfile {
  id: DesignProfileId;
  composition: "editorial" | "minimal" | "bold";
  font_pair: "editorial" | "sans";
  hero_arrangement: string;
  mobile_arrangement: string;
  service_layout: string;
  section_rhythm: string;
  typography: string;
  image_treatment: string;
}

export const DESIGN_PROFILES: Readonly<Record<DesignProfileId, DesignProfile>> =
  {
    "editorial-spread": {
      id: "editorial-spread",
      composition: "editorial",
      font_pair: "editorial",
      hero_arrangement: "asymmetric-editorial-spread",
      mobile_arrangement: "headline-body-image-stack",
      service_layout: "numbered-editorial-ledger",
      section_rhythm: "alternating-wide-and-tight",
      typography:
        "High-contrast display headings with compact sans-serif annotations",
      image_treatment: "wide-crop-with-caption-space",
    },
    "service-index": {
      id: "service-index",
      composition: "minimal",
      font_pair: "sans",
      hero_arrangement: "compact-intro-with-directory-cue",
      mobile_arrangement: "directory-first-single-column",
      service_layout: "bordered-numbered-directory",
      section_rhythm: "compact-continuous-index",
      typography: "Quiet sans-serif hierarchy with tabular labels",
      image_treatment: "optional-contained-documentary-crop",
    },
    "type-poster": {
      id: "type-poster",
      composition: "bold",
      font_pair: "sans",
      hero_arrangement: "oversized-poster-field",
      mobile_arrangement: "cropped-type-block-stack",
      service_layout: "high-contrast-poster-panels",
      section_rhythm: "alternating-impact-bands",
      typography: "Oversized uppercase display type with dense supporting copy",
      image_treatment: "optional-full-bleed-hard-crop",
    },
  };

function isDesignProfileId(value: unknown): value is DesignProfileId {
  return typeof value === "string" && Object.hasOwn(DESIGN_PROFILES, value);
}

export function resolveDesignProfile(theme: JsonObject): DesignProfile | null {
  const selected = theme.design_profile;
  if (selected === undefined || selected === null) return null;
  if (!isDesignProfileId(selected)) {
    throw new Error(`Unknown design profile: ${String(selected)}`);
  }
  const profile = DESIGN_PROFILES[selected];
  if (theme.composition !== profile.composition) {
    throw new Error(
      `Design profile ${selected} requires composition=${profile.composition}`,
    );
  }
  if (theme.font_pair !== profile.font_pair) {
    throw new Error(
      `Design profile ${selected} requires font_pair=${profile.font_pair}`,
    );
  }
  return profile;
}

export function validateDesignTheme(theme: JsonObject): void {
  resolveDesignProfile(theme);
}
