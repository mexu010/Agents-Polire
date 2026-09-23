import type { JsonObject } from "./contracts.js";

type Viewport = { width: number; height: number };

const sameViewport = (left: unknown, right: unknown): boolean => {
  const a = left as Viewport | null;
  const b = right as Viewport | null;
  return Boolean(a && b && a.width === b.width && a.height === b.height);
};

const routeFromUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const route = new URL(value).pathname;
    return route === "/" ? route : route.replace(/\/$/, "");
  } catch {
    return null;
  }
};

const locatorData = (value: unknown): JsonObject | null => {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : null;
  } catch {
    return null;
  }
};

const substantive = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length >= 12;

export function validateVisualQA(data: JsonObject, input: JsonObject): void {
  if (input.visual_contract_version !== "rendered-views/2") return;

  const requirements = new Map<string, JsonObject>(
    (input.required_checks as JsonObject[]).map((item) => [
      String(item.check_id),
      item,
    ]),
  );
  const evidence = new Map<string, JsonObject>(
    (input.evidence as JsonObject[]).map((item) => [
      String(item.evidence_id),
      item,
    ]),
  );
  const images = new Map<string, JsonObject>(
    (input.images as JsonObject[]).map((item) => [
      String(item.evidence_id),
      item,
    ]),
  );
  const buildHash = String((input.build as JsonObject).artifact_hash ?? "");

  const matchingScreenshot = (
    subject: JsonObject,
    route: string,
    viewport: Viewport | null,
  ): JsonObject | null => {
    for (const evidenceId of subject.evidence_ids as string[]) {
      const proof = evidence.get(evidenceId);
      const image = images.get(evidenceId);
      const locator = locatorData(proof?.locator);
      if (
        proof?.kind === "screenshot" &&
        image &&
        proof.artifact_hash === buildHash &&
        proof.excerpt === image.sha256 &&
        locator?.route === route &&
        locator?.full_page === true &&
        sameViewport(locator?.viewport, viewport) &&
        routeFromUrl(proof.source_url) === route &&
        (!viewport ||
          (image.width === viewport.width &&
            Number(image.height) >= viewport.height))
      )
        return proof;
    }
    return null;
  };

  for (const issue of data.issues as JsonObject[]) {
    const screenshotIds = (issue.evidence_ids as string[]).filter(
      (key) => evidence.get(key)?.kind === "screenshot",
    );
    const isVisualFinding =
      issue.viewport !== null && issue.viewport !== undefined
        ? true
        : screenshotIds.length > 0;
    if (!isVisualFinding) continue;
    const screenshot = matchingScreenshot(
      issue,
      String(issue.page_ref ?? ""),
      (issue.viewport ?? null) as Viewport | null,
    );
    if (!screenshot)
      throw new Error("visual finding needs a current matching screenshot");
    if (!substantive(issue.observation) || !substantive(issue.recommendation))
      throw new Error(
        "visual finding needs a concrete observation and recommendation",
      );
    if (!substantive(issue.acceptance_criterion))
      throw new Error("visual finding needs a concrete acceptance criterion");
  }

  for (const check of data.checks as JsonObject[]) {
    const requirement = requirements.get(String(check.check_id));
    if (requirement?.category !== "visual") continue;
    if (check.result === "not_tested") continue;
    const screenshot = matchingScreenshot(
      check,
      String(requirement.page_ref ?? ""),
      (requirement.viewport ?? null) as Viewport | null,
    );
    if (!screenshot)
      throw new Error(
        `visual decision needs a current matching screenshot: ${String(check.check_id)}`,
      );
    if (check.result !== "fail") continue;
    const finding = (data.issues as JsonObject[]).find(
      (issue) =>
        (issue.evidence_ids as string[]).includes(
          String(screenshot.evidence_id),
        ) &&
        issue.page_ref === requirement.page_ref &&
        sameViewport(issue.viewport, requirement.viewport) &&
        substantive(issue.observation) &&
        substantive(issue.recommendation) &&
        substantive(issue.acceptance_criterion),
    );
    if (!finding)
      throw new Error(
        `visual failure needs a corresponding finding: ${String(check.check_id)}`,
      );
  }
}
