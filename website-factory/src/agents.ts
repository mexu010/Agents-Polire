import { id, validate, type AgentName, type JsonObject } from "./contracts.js";
import { scoreQualification, dimensionScore } from "./scoring.js";
import common from "../prompts/common.js";
import scout from "../prompts/scout.js";
import audit from "../prompts/audit.js";
import qualifier from "../prompts/qualifier.js";
import strategist from "../prompts/strategist.js";
import builder from "../prompts/builder.js";
import qa from "../prompts/qa.js";
import sales from "../prompts/sales.js";
import { assertCopyPolicy, assertSubjectPolicy } from "./copy-policy.js";
import { decodeHTML } from "entities";
import { validateDesignPlan } from "./design-policy.js";

const prompts: Record<AgentName, string> = {
  scout,
  audit,
  qualifier,
  strategist,
  builder,
  qa,
  sales,
};
const outputSchema: Record<AgentName, string> = {
  scout: "ScoutOutput",
  audit: "AuditOutput",
  qualifier: "QualifierOutput",
  strategist: "StrategistOutput",
  builder: "BuilderOutput",
  qa: "QAOutput",
  sales: "SalesOutput",
};
export function promptFor(agent: AgentName): string {
  return `${common}\n\n${prompts[agent]}`;
}
const evidence = (input: JsonObject): Map<string, JsonObject> =>
  new Map<string, JsonObject>(
    (input.evidence ?? []).map((e: JsonObject): [string, JsonObject] => [
      e.evidence_id,
      e,
    ]),
  );
const facts = (input: JsonObject): Map<string, JsonObject> =>
  new Map<string, JsonObject>(
    (input.profile?.facts ?? input.facts ?? []).map(
      (f: JsonObject): [string, JsonObject] => [f.fact_id, f],
    ),
  );
function assertIds(
  ids: string[],
  allowed: Map<string, unknown>,
  label: string,
): void {
  for (const key of ids)
    if (!allowed.has(key))
      throw new Error(`${label} reference does not exist: ${key}`);
}
function assertEvidence(
  ids: string[],
  source: Map<string, JsonObject>,
  claim?: string | null,
): void {
  assertIds(ids, source, "evidence");
  if (
    claim &&
    ids.length &&
    !ids.some(
      (key) =>
        (source.get(key)?.excerpt ?? "")
          .toLocaleLowerCase()
          .includes(claim.toLocaleLowerCase()) ||
        containsEvidenceValue(source.get(key)?.excerpt ?? "", claim),
    )
  )
    throw new Error(`evidence does not support claim: ${claim}`);
}

const normaliseEvidence = (value: string) =>
  decodeHTML(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const containsEvidenceValue = (text: string, value: string) => {
  const haystack = normaliseEvidence(text);
  const needle = normaliseEvidence(value);
  return Boolean(needle) && ` ${haystack} `.includes(` ${needle} `);
};
function assertTokenEvidence(
  ids: string[],
  source: Map<string, JsonObject>,
  claim: string,
): void {
  assertIds(ids, source, "evidence");
  if (
    !ids.some((key) =>
      containsEvidenceValue(source.get(key)?.excerpt ?? "", claim),
    )
  )
    throw new Error(`evidence does not support claim: ${claim}`);
}
const canonicalHost = (url: string) => {
  try {
    return new URL(url).hostname.toLocaleLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};
function assertFactEvidence(
  proposal: JsonObject,
  source: Map<string, JsonObject>,
): void {
  if (proposal.field === "country" && proposal.value === "CH") {
    assertIds(proposal.evidence_ids, source, "evidence");
    const text = proposal.evidence_ids
      .map((key: string) => source.get(key)?.excerpt ?? "")
      .join(" ")
      .toLocaleLowerCase();
    if (
      !/\b(schweiz|suisse|svizzera|switzerland)\b/.test(text) &&
      !/\bch\s*[-–]\s*\d{4}\b/i.test(text)
    )
      throw new Error("evidence does not support country CH");
    return;
  }
  if (
    typeof proposal.value === "string" &&
    (proposal.field === "address" || /\d/.test(proposal.value))
  ) {
    assertTokenEvidence(proposal.evidence_ids, source, proposal.value);
    return;
  }
  assertEvidence(proposal.evidence_ids, source, proposal.value);
}
function factExpiry(
  ids: string[],
  source: Map<string, JsonObject>,
): string | null {
  const times = ids
    .map((key) => Date.parse(source.get(key)?.observed_at ?? ""))
    .filter(Number.isFinite);
  return times.length
    ? new Date(Math.min(...times) + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
}
function checkGrounding(value: JsonObject, input: JsonObject): void {
  const allowedEvidence = evidence(input);
  const allowedFacts = facts(input);
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as JsonObject;
    if (Array.isArray(o.evidence_ids))
      assertIds(o.evidence_ids, allowedEvidence, "evidence");
    if (Array.isArray(o.fact_ids)) assertIds(o.fact_ids, allowedFacts, "fact");
    walk(Object.values(o));
  };
  walk(value);
}
function operatorValue(input: JsonObject, path: string): string | null {
  if (
    !["agency.name", "offer.services", "offer.confirmed_price"].includes(path)
  )
    throw new Error(`operator field is not allowed: ${path}`);
  const value = path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as JsonObject)[key]
          : undefined,
      input,
    );
  if (
    path === "offer.confirmed_price" &&
    (value === null || value === undefined)
  )
    throw new Error("unconfirmed price may not be used in copy");
  return Array.isArray(value)
    ? value.map(String).join(" ")
    : value === null || value === undefined
      ? null
      : String(value);
}
function assertSafeClaims(value: unknown, input: JsonObject): void {
  const allowed = facts(input);
  const improvements = new Map<string, string>(
    (input.approved_improvements ?? []).map((item: JsonObject) => [
      item.issue_id,
      String(item.description ?? ""),
    ]),
  );
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const item = node as JsonObject;
    if (
      typeof item.text === "string" &&
      typeof item.kind === "string" &&
      Array.isArray(item.fact_ids)
    ) {
      const supports = [
        ...item.fact_ids.map((key: string) =>
          String(allowed.get(key)?.value ?? ""),
        ),
        ...(item.improvement_issue_ids ?? []).map(
          (key: string) => improvements.get(key) ?? "",
        ),
        ...(item.operator_fields ?? []).map(
          (path: string) => operatorValue(input, path) ?? "",
        ),
      ].filter(Boolean);
      assertCopyPolicy(item.text, item.kind, supports);
    }
    Object.values(item).forEach(walk);
  };
  walk(value);
}
function assertSafeSubjects(subjects: string[], input: JsonObject): void {
  const companyNames = [...facts(input).values()]
    .filter((fact) => fact.field === "company_name" && fact.value)
    .map((fact) => String(fact.value));
  for (const subject of subjects) assertSubjectPolicy(subject, companyNames);
}
function changedPaths(before: unknown, after: unknown, path = ""): string[] {
  if (Object.is(before, after)) return [];
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) !== Array.isArray(after)
  )
    return [path || "/"];
  const left = before as Record<string, unknown>;
  const right = after as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(
    (key) =>
      changedPaths(
        left[key],
        right[key],
        `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
      ),
  );
}
function registerScout(output: JsonObject, input: JsonObject): JsonObject {
  const data = output.data;
  const allowed = evidence(input);
  const pages = new Set(
    (input.crawl_pages ?? []).map((p: JsonObject) => p.page_ref),
  );
  const registeredFacts = data.facts.map((p: JsonObject) => {
    if (p.value !== null && p.interpretation === "source_reported") {
      if (!p.evidence_ids.length) throw new Error("fact needs evidence");
      assertFactEvidence(p, allowed);
    } else assertIds(p.evidence_ids, allowed, "evidence");
    return {
      fact_id: id(),
      field: p.field,
      value: p.value,
      evidence_ids: p.evidence_ids,
      verification:
        p.interpretation === "source_reported"
          ? "source_reported"
          : p.interpretation,
      valid_until: factExpiry(p.evidence_ids, allowed),
    };
  });
  const contacts = data.contacts.map((c: JsonObject) => {
    if (!c.evidence_ids.length) throw new Error("contact needs evidence");
    assertIds(c.evidence_ids, allowed, "evidence");
    const observedContactUrl =
      c.kind === "contact_page" &&
      c.evidence_ids.some((key: string) => {
        const proof = allowed.get(key);
        return proof?.kind === "html" && proof.source_url === c.value;
      });
    if (!observedContactUrl) assertEvidence(c.evidence_ids, allowed, c.value);
    return { contact_id: id(), ...c };
  });
  for (const page of data.pages) {
    if (!pages.has(page.page_ref))
      throw new Error(`page reference does not exist: ${page.page_ref}`);
    assertIds(page.evidence_ids, allowed, "evidence");
  }
  const agency = data.agency;
  if (agency.relationship === "explicit_website_implementation") {
    if (!agency.agency_name || !agency.evidence_ids.length)
      throw new Error(
        "explicit agency relationship requires name and evidence",
      );
    assertIds(agency.evidence_ids, allowed, "evidence");
    const agencyEvidence = agency.evidence_ids.map((key: string) =>
      allowed.get(key),
    );
    const proof = agencyEvidence
      .map((item: JsonObject) => item?.excerpt ?? "")
      .join(" ");
    const identity = data.facts.find(
      (fact: JsonObject) => fact.field === "company_name" && fact.value,
    )?.value;
    const namedAgency = containsEvidenceValue(proof, agency.agency_name);
    const namedIdentity =
      typeof identity === "string" && containsEvidenceValue(proof, identity);
    const targetHost = canonicalHost(input.seed.website);
    const allOnTarget =
      Boolean(targetHost) &&
      agencyEvidence.every(
        (item: JsonObject) =>
          canonicalHost(item?.source_url ?? "") === targetHost,
      );
    const implementationStatement =
      /(?:website|webseite).*(?:umgesetzt|erstellt|entwickelt)|(?:umgesetzt|erstellt|entwickelt).*?(?:website|webseite)/i.test(
        proof,
      ) && namedIdentity;
    const officialDesignCredit =
      /\b(?:webdesign|web\s+design|website\s+design)\s+(?:by|von|durch)\b/i.test(
        proof,
      ) && allOnTarget;
    if (
      !identity ||
      !namedAgency ||
      !(implementationStatement || officialDesignCredit)
    )
      throw new Error(
        "agency evidence must name agency, implementation and target identity",
      );
  }
  const signal =
    agency.relationship === "explicit_website_implementation"
      ? {
          agency_name: agency.agency_name,
          status: "evidenced_implementation",
          evidence_ids: agency.evidence_ids,
          score: 100,
        }
      : {
          agency_name: agency.agency_name,
          status: "unknown",
          evidence_ids: agency.evidence_ids,
          score: null,
        };
  return validate("Profile", {
    facts: registeredFacts,
    contacts,
    agency: signal,
    technology_signals: data.technology_signals,
    contradictions: data.contradictions,
  });
}
function registerAudit(output: JsonObject, input: JsonObject): JsonObject {
  const data = output.data;
  const allowed = evidence(input);
  const pages = new Set(
    (input.crawl_pages ?? []).map((p: JsonObject) => p.page_ref),
  );
  const imageEvidence = new Set(
    (input.images ?? []).map((image: JsonObject) => image.evidence_id),
  );
  for (const name of ["mobile_usability"]) {
    const dimension = data.dimensions[name];
    if (
      dimension.level !== null &&
      !dimension.evidence_ids.some((key: string) => imageEvidence.has(key))
    )
      throw new Error(`${name} needs bound image evidence`);
  }
  for (const d of Object.values(data.dimensions) as JsonObject[]) {
    if (
      d.level !== null &&
      (!d.evidence_ids.length || !d.checked_criteria.length)
    )
      throw new Error("audit dimension needs evidence and checked criteria");
    assertIds(d.evidence_ids, allowed, "evidence");
  }
  const issues = data.issues.map((issue: JsonObject) => {
    if (!pages.has(issue.page_ref))
      throw new Error(`page reference does not exist: ${issue.page_ref}`);
    if (!issue.evidence_ids.length) throw new Error("issue needs evidence");
    assertIds(issue.evidence_ids, allowed, "evidence");
    return { issue_id: id(), ...issue };
  });
  const dims = data.dimensions;
  const score = (name: string) => dimensionScore(dims[name]);
  const perfEvidence = [...allowed.values()].find(
    (e: JsonObject) => e.kind === "metric" && e.unit === "lighthouse_mobile",
  );
  const performance = perfEvidence?.numeric_value ?? null;
  const weighted: Array<[number | null, number]> = [
    [score("mobile_usability"), 0.25],
    [score("conversion"), 0.25],
    [performance, 0.2],
    [score("content_clarity"), 0.15],
    [score("trust_transparency"), 0.1],
    [score("technical_seo"), 0.05],
  ];
  const coverage = weighted.reduce((n, [s, w]) => n + (s === null ? 0 : w), 0);
  const raw =
    weighted.reduce((n, [s, w]) => n + (s === null ? 0 : s * w), 0) /
    (coverage || 1);
  return validate("AuditResult", {
    dimensions: dims,
    performance_score: performance,
    quality_score:
      coverage >= 0.7 &&
      score("mobile_usability") !== null &&
      score("conversion") !== null
        ? raw
        : null,
    coverage,
    issues,
    limitations: data.limitations,
  });
}
function registerSales(output: JsonObject, input: JsonObject): JsonObject {
  const data = output.data;
  const allFacts = facts(input);
  assertSafeClaims(data, input);
  const improvements = new Set(
    (input.approved_improvements ?? []).map((x: JsonObject) => x.issue_id),
  );
  if (
    new Set(data.subject_options).size !== 2 ||
    data.subject_options.some((s: string) => /^(re|fwd):/i.test(s))
  )
    throw new Error("Sales subjects must be distinct and truthful");
  assertSafeSubjects(data.subject_options, input);
  for (const p of data.body_paragraphs) {
    assertIds(p.fact_ids, allFacts, "fact");
    for (const issue of p.improvement_issue_ids)
      if (!improvements.has(issue))
        throw new Error(`improvement reference does not exist: ${issue}`);
    if (
      p.kind === "factual" &&
      !(
        p.fact_ids.length ||
        p.improvement_issue_ids.length ||
        p.operator_fields.length
      )
    )
      throw new Error("factual sales paragraph needs a source");
    if (/https?:\/\/|\b\S+@\S+\b/.test(p.text))
      throw new Error("Sales text may not introduce URLs or contacts");
  }
  return {
    subject_options: data.subject_options,
    body_paragraphs: data.body_paragraphs,
    referenced_issue_ids: data.referenced_issue_ids,
    personalization_notes: data.personalization_notes,
    draft_only: true,
    can_send: false,
  };
}
function registerStrategist(output: JsonObject, input: JsonObject): JsonObject {
  const data = output.data;
  validateDesignPlan(data, input);
  checkGrounding(data, input);
  assertSafeClaims(data, input);
  const issues = new Set(
    (input.audit?.issues ?? []).map((x: JsonObject) => x.issue_id),
  );
  const assets = new Set(
    (input.approved_assets ?? []).map((x: JsonObject) => x.asset_id),
  );
  if (
    data.template_id !== input.template.template_id ||
    data.template_version !== input.template.version
  )
    throw new Error("Strategist template does not match input");
  for (const asset of data.asset_ids)
    if (!assets.has(asset))
      throw new Error(`asset reference does not exist: ${asset}`);
  const routes = new Set<string>();
  const pages = data.pages.map((page: JsonObject) => {
    if (routes.has(page.route))
      throw new Error(`duplicate route: ${page.route}`);
    routes.add(page.route);
    return {
      ...page,
      sections: page.sections.map((section: JsonObject) => {
        if (
          !input.template.components.includes(section.component) ||
          !input.template.variants.includes(section.variant)
        )
          throw new Error(
            "Strategist used an unavailable component or variant",
          );
        for (const issue of section.addressed_issue_ids)
          if (!issues.has(issue))
            throw new Error(`issue reference does not exist: ${issue}`);
        if (section.asset_id !== null && !assets.has(section.asset_id))
          throw new Error(
            `asset reference does not exist: ${section.asset_id}`,
          );
        return { section_id: id(), ...section };
      }),
    };
  });
  return validate("Brief", { ...data, pages, locale: input.campaign.locale });
}
function registerBuilder(output: JsonObject, input: JsonObject): JsonObject {
  const data = output.data;
  const site = data.site_spec;
  if (site.theme.composition !== input.brief.theme.composition)
    throw new Error("Builder must preserve the brief composition");
  checkGrounding(site, input);
  assertSafeClaims(site, input);
  const sections = new Set(
    input.brief.pages.flatMap((p: JsonObject) =>
      p.sections.map((s: JsonObject) => s.section_id),
    ),
  );
  const issues = new Set([
    ...input.brief.pages.flatMap((p: JsonObject) =>
      p.sections.flatMap((s: JsonObject) => s.addressed_issue_ids),
    ),
    ...input.repair_tasks.map((task: JsonObject) => task.issue_id),
  ]);
  const assets = new Set(
    input.approved_assets.map((x: JsonObject) => x.asset_id),
  );
  const contacts = new Set(input.contacts.map((x: JsonObject) => x.contact_id));
  if (
    site.template_id !== input.brief.template_id ||
    site.template_version !== input.brief.template_version ||
    site.locale !== input.brief.locale
  )
    throw new Error("Builder changed the approved template or locale");
  const routes = site.pages.map((p: JsonObject) => p.route);
  const briefRoutes = input.brief.pages.map((p: JsonObject) => p.route);
  if (
    new Set(routes).size !== routes.length ||
    JSON.stringify(routes) !== JSON.stringify(briefRoutes)
  )
    throw new Error("Builder routes must match the brief");
  for (const asset of site.asset_ids)
    if (!assets.has(asset))
      throw new Error(`asset reference does not exist: ${asset}`);
  const seen = new Set<string>();
  const expectedByRoute = new Map(
    input.brief.pages.map((p: JsonObject) => [
      p.route,
      new Map(p.sections.map((s: JsonObject) => [s.section_id, s])),
    ]),
  );
  const copies: JsonObject[] = site.navigation.map((n: JsonObject) => n.label);
  for (const page of site.pages) {
    copies.push(page.title, page.meta_description);
    const expected = expectedByRoute.get(page.route) as Map<string, JsonObject>;
    for (const section of page.sections) {
      if (!sections.has(section.section_id) || seen.has(section.section_id))
        throw new Error(
          `section reference does not exist or is duplicated: ${section.section_id}`,
        );
      seen.add(section.section_id);
      const planned = expected.get(section.section_id);
      if (
        !planned ||
        planned.component !== section.component ||
        planned.variant !== section.variant
      )
        throw new Error(
          "Builder section must preserve route, component and variant from brief",
        );
      for (const issue of section.addressed_issue_ids)
        if (!issues.has(issue))
          throw new Error(`issue reference does not exist: ${issue}`);
      if (section.asset_id !== null && !assets.has(section.asset_id))
        throw new Error(`asset reference does not exist: ${section.asset_id}`);
      if (
        section.cta?.target === "section" &&
        !sections.has(section.cta.target_ref)
      )
        throw new Error("CTA section reference does not exist");
      if (
        section.cta?.target === "contact" &&
        !contacts.has(section.cta.target_ref)
      )
        throw new Error("CTA contact reference does not exist");
      copies.push(
        section.heading,
        ...section.body,
        ...section.items.flatMap((x: JsonObject) => [x.title, x.text]),
      );
      if (section.cta) copies.push(section.cta.label);
    }
  }
  if (seen.size !== sections.size)
    throw new Error("Builder omitted an approved brief section");
  for (const copy of copies)
    if (copy.kind === "factual" && copy.fact_ids.length === 0)
      throw new Error("factual copy needs a fact reference");
  const within = (path: string, allowed: string) =>
    path === allowed || path.startsWith(`${allowed}/`);
  for (const change of data.change_log) {
    if (!issues.has(change.issue_id))
      throw new Error(
        `change log issue reference does not exist: ${change.issue_id}`,
      );
    if (
      input.repair_tasks.length &&
      !input.repair_tasks.some(
        (task: JsonObject) =>
          task.issue_id === change.issue_id &&
          task.allowed_paths.some((path: string) => within(change.path, path)),
      )
    )
      throw new Error("Builder change is outside allowed repair path");
  }
  if (input.repair_tasks.length) {
    const changed = changedPaths(input.previous_site_spec, site);
    if (!changed.length)
      throw new Error("Builder repair did not change SiteSpec");
    const allowed = input.repair_tasks.flatMap(
      (task: JsonObject) => task.allowed_paths,
    );
    for (const path of changed)
      if (!allowed.some((prefix: string) => within(path, prefix)))
        throw new Error(
          `Builder changed SiteSpec outside allowed repair path: ${path}`,
        );
  }
  return validate("SiteSpec", site);
}
function registerQA(output: JsonObject, input: JsonObject): JsonObject {
  const data = output.data;
  checkGrounding(data, input);
  const required = new Map<string, JsonObject>(
    input.required_checks.map((x: JsonObject): [string, JsonObject] => [
      x.check_id,
      x,
    ]),
  );
  const runtime = new Map<string, JsonObject>(
    input.test_results.map((x: JsonObject): [string, JsonObject] => [
      x.check_id,
      x,
    ]),
  );
  const auditIssues = new Set(
    input.audit_issues.map((x: JsonObject) => x.issue_id),
  );
  const seen = new Set<string>();
  if (runtime.size !== input.test_results.length)
    throw new Error("duplicate runtime check result");
  for (const [key, req] of required)
    if ((req as JsonObject).executor === "runtime" && !runtime.has(key))
      throw new Error(`required runtime check missing: ${key}`);
  for (const [key] of runtime) {
    const req = required.get(key) as JsonObject | undefined;
    if (!req || req.executor !== "runtime")
      throw new Error(`unexpected runtime check: ${key}`);
  }
  for (const check of data.checks) {
    const req = required.get(check.check_id) as JsonObject | undefined;
    if (!req) throw new Error(`QA check is not required: ${check.check_id}`);
    if (req.executor !== "qa_model")
      throw new Error(`QA may not replace runtime check: ${check.check_id}`);
    if (seen.has(check.check_id))
      throw new Error(`duplicate QA check: ${check.check_id}`);
    seen.add(check.check_id);
  }
  for (const [key, req] of required)
    if ((req as JsonObject).executor === "qa_model" && !seen.has(key))
      throw new Error(`required QA check missing: ${key}`);
  for (const issue of data.resolved_audit_issue_ids)
    if (!auditIssues.has(issue))
      throw new Error(`audit issue reference does not exist: ${issue}`);
  const issues = data.issues.map((x: JsonObject) => ({ issue_id: id(), ...x }));
  const checks = [...runtime.values(), ...data.checks];
  for (const check of data.checks) {
    const requirement = required.get(check.check_id) as JsonObject;
    if (requirement.category === "visual" && check.result === "pass") {
      const matchingImage = input.images.some(
        (image: JsonObject) =>
          check.evidence_ids.includes(image.evidence_id) &&
          (!requirement.viewport || image.width === requirement.viewport.width),
      );
      if (!matchingImage)
        throw new Error(
          `visual pass needs matching image evidence: ${check.check_id}`,
        );
    }
  }
  const decision =
    input.build.result === "pass" &&
    checks.every((x: JsonObject) => x.result === "pass") &&
    !issues.some((x: JsonObject) => ["major", "blocker"].includes(x.severity))
      ? "pass"
      : checks.some((x: JsonObject) => x.result === "not_tested")
        ? "needs_input"
        : "fail";
  return validate("QAResult", {
    decision,
    checks,
    issues,
    resolved_audit_issue_ids: data.resolved_audit_issue_ids,
    limitations: data.limitations,
  });
}
function registerQualifier(output: JsonObject, input: JsonObject): JsonObject {
  const data = output.data;
  checkGrounding(data, input);
  for (const name of [
    "company_value",
    "budget_capacity",
    "website_importance",
  ]) {
    const item = data[name];
    if (item.level !== null && !item.evidence_ids.length)
      throw new Error(`${name} assessment needs evidence`);
  }
  if (data.budget_capacity.level !== null) {
    const source = evidence(input);
    const proof = data.budget_capacity.evidence_ids
      .map((key: string) => source.get(key)?.excerpt ?? "")
      .join(" ")
      .toLocaleLowerCase();
    if (!/(budget|preis|price|kosten|chf|fr\.)/.test(proof))
      throw new Error("budget capacity needs direct budget or price evidence");
  }
  for (const name of ["offer_fit", "implementation_fit"])
    if (
      data[name].assessment !== "unknown" &&
      !(
        data[name].evidence_ids.length ||
        data[name].fact_ids.length ||
        data[name].rule_ids.length
      )
    )
      throw new Error(`${name} needs grounded support`);
  return validate(
    "Qualification",
    scoreQualification(
      input.profile,
      input.audit,
      data,
      input.campaign,
      input.offer,
      input.template,
    ),
  );
}
export function processAgentOutput(
  agent: AgentName,
  output: JsonObject,
  input: JsonObject,
): JsonObject {
  validate(
    `${agent === "qa" ? "QA" : agent[0].toUpperCase() + agent.slice(1)}Input`,
    input,
  );
  validate(outputSchema[agent], output);
  if (output.data === null)
    return { data: null, gaps: output.gaps, notices: output.notices };
  if (agent === "scout") return registerScout(output, input);
  if (agent === "audit") return registerAudit(output, input);
  if (agent === "qualifier") return registerQualifier(output, input);
  if (agent === "strategist") return registerStrategist(output, input);
  if (agent === "builder") return registerBuilder(output, input);
  if (agent === "qa") return registerQA(output, input);
  if (agent === "sales") return registerSales(output, input);
  checkGrounding(output.data, input);
  return output.data;
}
export { scoreQualification } from "./scoring.js";
