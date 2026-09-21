import {
  ROOT_NAMES,
  schemaFor,
  validate,
  type AgentName,
  type JsonObject,
} from "./contracts.js";

/** Strict structured outputs require every property, using null for optional values.
 * https://developers.openai.com/api/docs/guides/structured-outputs#all-fields-must-be-required
 * Keep this wire representation separate from persisted, backward-compatible schemas.
 */
export function modelOutputSchema(agent: AgentName): JsonObject {
  const schema = structuredClone(schemaFor(`${ROOT_NAMES[agent]}Output`));
  const visit = (node: any): void => {
    if (!node || typeof node !== "object") return;
    if (node.properties) {
      const required = new Set<string>(node.required ?? []);
      for (const key of Object.keys(node.properties))
        if (!required.has(key))
          node.properties[key] = {
            anyOf: [node.properties[key], { type: "null" }],
          };
      node.required = Object.keys(node.properties);
    }
    Object.values(node).forEach(visit);
  };
  visit(schema);
  return schema;
}

export function readAgentModelOutput(
  agent: AgentName,
  value: unknown,
): JsonObject {
  const output = structuredClone(value) as JsonObject | null;
  // Only these two newly optional additions exist in agent output contracts.
  // Missing/invalid required fields and unknown keys are still rejected below.
  const design =
    agent === "strategist"
      ? output?.data
      : agent === "builder"
        ? output?.data?.site_spec
        : null;
  if (design && typeof design === "object") {
    if (agent === "strategist" && design.design_plan === null)
      delete design.design_plan;
    if (design.theme?.composition === null) delete design.theme.composition;
  }
  return validate(`${ROOT_NAMES[agent]}Output`, output);
}
