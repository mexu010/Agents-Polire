import { describe, expect, it } from "vitest";
import { validate } from "../src/contracts.js";
import { defaultConfig, validateConfig } from "../src/config.js";
import {
  buildAgentInput,
  fixtureInput,
  fixtureOutput,
} from "../src/fixtures.js";
import { processAgentOutput } from "../src/agents.js";
import { fixtureDesignResearch } from "../src/design-research.js";
import {
  DESIGN_CAPABILITIES_VERSION,
  DESIGN_PROFILES,
} from "../src/design-capabilities.js";
import {
  modelOutputSchema,
  readAgentModelOutput,
} from "../src/model-contracts.js";
import { comparisonContent } from "../src/design-concepts.js";

describe("versioned design upgrade contracts", () => {
  const theme = {
    font_pair: "editorial",
    palette: "light",
    accent_hex: null,
    spacing: "comfortable",
    motion: "none",
    composition: "editorial",
  };
  it("accepts a real profile and rejects unimplemented profile labels", () => {
    expect(() =>
      validate("Theme", { ...theme, design_profile: "editorial-spread" }),
    ).not.toThrow();
    expect(() =>
      validate("Theme", { ...theme, design_profile: "luxury-magic" }),
    ).toThrow();
    expect(() => validate("Theme", theme)).not.toThrow();
  });
  it("keeps concept selection explicitly opt in", () => {
    const config = structuredClone(defaultConfig());
    expect(config.designExploration?.enabled).toBe(false);
    expect(() =>
      validateConfig({ ...config, designExploration: { enabled: true } }),
    ).not.toThrow();
  });
  it("validates a distinct concept task and refuses invented capabilities or repeated layouts", () => {
    const context: any = fixtureInput();
    for (const agent of ["scout", "audit", "qualifier"] as const) {
      const input = buildAgentInput(agent, context);
      context[
        { scout: "profile", audit: "audit", qualifier: "qualification" }[agent]
      ] = processAgentOutput(agent, fixtureOutput(agent, input), input);
    }
    context.template = {
      ...context.template,
      font_pairs: ["sans", "editorial"],
      design_profiles: Object.keys(DESIGN_PROFILES),
      capabilities_version: DESIGN_CAPABILITIES_VERSION,
    };
    context.designResearch = fixtureDesignResearch();
    const input = buildAgentInput("strategist", context, "design_exploration");
    const raw = fixtureOutput("strategist", input);
    const schema = modelOutputSchema("strategist", "design_exploration");
    expect(schema.$defs.ConceptSet.properties.concepts.minItems).toBe(3);
    expect(() =>
      readAgentModelOutput("strategist", raw, "design_exploration"),
    ).not.toThrow();
    expect(() => readAgentModelOutput("strategist", raw)).toThrow();
    expect(() => modelOutputSchema("builder", "design_exploration")).toThrow();
    raw.data.concepts[0].rationale =
      "Wir haben die Animationen geprüft und garantieren 300% Umsatz.";
    const accepted = processAgentOutput(
      "strategist",
      raw,
      input,
      "design_exploration",
    );
    expect(JSON.stringify(accepted)).not.toMatch(
      /300%|garantieren|Animationen geprüft/,
    );
    expect(input.comparison_content.asset_ids).toEqual([]);
    context.approvedAssets = [
      { kind: "font", asset_id: "approved-font" },
      { kind: "logo", asset_id: "approved-logo" },
    ];
    expect(comparisonContent(context).asset_ids).toEqual([]);
    context.approvedAssets.push({ kind: "photo", asset_id: "approved-photo" });
    expect(comparisonContent(context).asset_ids).toEqual(["approved-photo"]);
    const repeated = structuredClone(raw);
    repeated.data.concepts[1] = repeated.data.concepts[0];
    expect(() =>
      processAgentOutput("strategist", repeated, input, "design_exploration"),
    ).toThrow(/differences/);
    raw.data.concepts[0].reference_ids = ["invented-reference"];
    expect(() =>
      processAgentOutput("strategist", raw, input, "design_exploration"),
    ).toThrow(/invented reference/);
  });
});
