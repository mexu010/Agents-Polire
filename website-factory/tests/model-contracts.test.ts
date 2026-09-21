import { expect, test } from "vitest";
import {
  modelOutputSchema,
  readAgentModelOutput,
} from "../src/model-contracts.js";
import { AGENTS, schemaFor } from "../src/contracts.js";
import {
  fixtureInput,
  fixtureOutput,
  buildAgentInput,
} from "../src/fixtures.js";
import { processAgentOutput } from "../src/agents.js";

test("wire schemas require every property while stored legacy schemas remain optional", () => {
  const check = (schema: any): void => {
    if (!schema || typeof schema !== "object") return;
    if (schema.properties)
      expect([...schema.required].sort()).toEqual(
        Object.keys(schema.properties).sort(),
      );
    Object.values(schema).forEach(check);
  };
  for (const agent of AGENTS) check(modelOutputSchema(agent));
  expect(schemaFor("Theme").required).not.toContain("composition");
  expect(
    modelOutputSchema("strategist").$defs.Theme.properties.composition.anyOf,
  ).toContainEqual({ type: "null" });
});

test("normalises only nullable legacy design additions, preserves required nulls and rejects arbitrary fields", () => {
  const context: any = fixtureInput();
  for (const agent of ["scout", "audit", "qualifier"] as const) {
    const input = buildAgentInput(agent, context);
    context[
      { scout: "profile", audit: "audit", qualifier: "qualification" }[agent]
    ] = processAgentOutput(agent, fixtureOutput(agent, input), input);
  }
  const input = buildAgentInput("strategist", context);
  const raw = fixtureOutput("strategist", input);
  raw.data.design_plan = null;
  raw.data.theme.composition = null;
  const parsed = readAgentModelOutput("strategist", raw);
  expect(parsed.data).not.toHaveProperty("design_plan");
  expect(parsed.data.theme).not.toHaveProperty("composition");
  expect(parsed.data.pages[0].sections[0].asset_id).toBeNull();
  expect(raw.data).toHaveProperty("design_plan", null);
  expect(() =>
    processAgentOutput("strategist", parsed, {
      ...input,
      design_research: { references: [] },
    }),
  ).toThrow(/design/i);
  raw.data.injected = null;
  expect(() => readAgentModelOutput("strategist", raw)).toThrow();
});
