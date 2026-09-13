import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

/** Dynamic JSON exists only at this validated schema boundary. */
export type JsonObject = Record<string, any>;
export type AgentName =
  "scout" | "audit" | "qualifier" | "strategist" | "builder" | "qa" | "sales";
export const AGENTS: AgentName[] = [
  "scout",
  "audit",
  "qualifier",
  "strategist",
  "builder",
  "qa",
  "sales",
];
export const ROOT_NAMES: Record<AgentName, string> = {
  scout: "Scout",
  audit: "Audit",
  qualifier: "Qualifier",
  strategist: "Strategist",
  builder: "Builder",
  qa: "QA",
  sales: "Sales",
};
export const contractLibrary = JSON.parse(
  readFileSync(
    new URL("../spec/contracts.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new (Ajv2020 as any)({ allErrors: true, strict: false });
(addFormats as any)(ajv);
const validators = new Map<string, any>();
export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
export function schemaFor(name: string): JsonObject {
  if (!contractLibrary.$defs[name])
    throw new ValidationError("Unknown schema " + name);
  const names = new Set<string>();
  function visit(node: any): void {
    if (!node || typeof node !== "object") return;
    if (node.$ref) {
      const key = node.$ref.split("/").at(-1);
      if (!names.has(key)) {
        names.add(key);
        visit(contractLibrary.$defs[key]);
      }
    }
    Object.values(node).forEach(visit);
  }
  visit(contractLibrary.$defs[name]);
  return {
    ...contractLibrary.$defs[name],
    $defs: Object.fromEntries(
      [...names].map((k) => [k, contractLibrary.$defs[k]]),
    ),
  };
}
export function validate(name: string, value: unknown): JsonObject {
  let validator = validators.get(name);
  if (!validator) {
    validator = ajv.compile(schemaFor(name));
    validators.set(name, validator);
  }
  if (!validator(value)) {
    const issues = validator.errors
      ?.slice(0, 8)
      .map((e: any) => `${e.instancePath || "/"}: ${e.keyword}`)
      .join("; ");
    throw new ValidationError(`${name}: ${issues}`);
  }
  return value as JsonObject;
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export function hash(value: unknown): string {
  return createHash("sha256")
    .update(
      typeof value === "string" ? value : JSON.stringify(canonical(value)),
    )
    .digest("hex");
}
export function id(): string {
  return randomUUID();
}
export function now(): string {
  return new Date().toISOString();
}
