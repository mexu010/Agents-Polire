import {
  hash,
  validate,
  type AgentName,
  type JsonObject,
} from "./contracts.js";

const stamp = "2026-09-11T10:00:00.000Z";
const ev = (
  evidence_id: string,
  excerpt: string,
  kind: "html" | "metric" = "html",
  numeric_value: number | null = null,
  unit: string | null = null,
) => ({
  evidence_id,
  kind,
  source_url: "https://fixture.alpina-service.example/",
  observed_at: stamp,
  artifact_hash: hash(evidence_id),
  locator: "fixture",
  excerpt,
  numeric_value,
  unit,
});
export function fixtureInput(): JsonObject {
  const evidence = [
    ev("e-name", "Alpina Sanitär GmbH, 8004 Zürich, Schweiz."),
    ev(
      "e-services",
      "Sanitärinstallationen, Badumbauten und Reparaturen in Zürich.",
    ),
    ev(
      "e-contact",
      "Kontakt: hallo@alpina-sanitaer.example, Telefon 044 555 01 02. Kontaktseite: https://fixture.alpina-service.example/kontakt",
    ),
    ev("e-goal", "Jetzt Beratung anfragen über unsere Kontaktseite."),
    ev(
      "e-credit",
      "Website umgesetzt durch Werkstatt Nord für Alpina Sanitär GmbH.",
    ),
    ev(
      "e-budget",
      "Für den Websiteumbau ist ein Budgetrahmen von CHF 12’000 bestätigt.",
    ),
    ev(
      "e-mobile",
      "Auf 375 px verdeckt die feste Navigation den Button Beratung anfragen.",
    ),
    ev(
      "e-conversion",
      "Die Startseite enthält keinen sichtbaren Kontaktaufruf oberhalb der ersten Sektion.",
    ),
    ev("e-metric", "Mobile Lighthouse 62.", "metric", 62, "lighthouse_mobile"),
  ];
  return {
    campaign: {
      country: "CH",
      regions: ["Zürich"],
      industries: ["Sanitär"],
      adjacent_industries: [],
      locale: "de-CH",
      goals: ["Anfragen"],
      exclusion_rules: [],
      max_pages: 3,
    },
    seed: {
      website: "https://fixture.alpina-service.example/",
      operator_company_name: null,
    },
    crawl_pages: [
      {
        page_ref: "page-home",
        url: "https://fixture.alpina-service.example/",
        outcome: "ok",
        evidence_ids: [
          "e-name",
          "e-services",
          "e-contact",
          "e-goal",
          "e-credit",
          "e-mobile",
          "e-conversion",
        ],
      },
      {
        page_ref: "page-contact",
        url: "https://fixture.alpina-service.example/kontakt",
        outcome: "ok",
        evidence_ids: ["e-contact"],
      },
    ],
    technology_observations: [],
    evidence,
    images: [
      {
        evidence_id: "e-mobile",
        attachment_ref: "fixture-mobile.png",
        sha256: hash("fixture-mobile"),
        width: 375,
        height: 800,
      },
    ],
    offer: {
      offer_id: "fixture-offer",
      services: ["Website für lokale Dienstleister"],
      unsupported_features: [],
      confirmed_price: null,
    },
    template: {
      template_id: "local-service",
      version: "1",
      components: ["hero", "services", "contact"],
      variants: ["split", "stacked", "cards"],
      font_pairs: ["sans"],
      features: ["contact"],
    },
  };
}
export function buildAgentInput(
  agent: AgentName,
  context: JsonObject,
): JsonObject {
  const crawl = context.crawl ?? context;
  const evidence = crawl.evidence ?? context.evidence ?? [];
  const images = (crawl.images ?? []).map((image: JsonObject) =>
    image.attachment_ref
      ? image
      : {
          evidence_id: image.evidence_id,
          attachment_ref: image.path,
          sha256: image.sha256,
          width: image.width,
          height: image.height,
        },
  );
  switch (agent) {
    case "scout":
      return validate("ScoutInput", {
        campaign: context.campaign,
        seed: context.seed,
        crawl_pages: crawl.crawl_pages ?? [],
        technology_observations: crawl.technology_observations ?? [],
        evidence,
        images,
      });
    case "audit":
      return validate("AuditInput", {
        profile: context.profile,
        crawl_pages: crawl.crawl_pages ?? [],
        criteria: [
          "mobile_usability",
          "conversion",
          "content_clarity",
          "trust_transparency",
          "technical_seo",
        ],
        evidence,
        images,
      });
    case "qualifier":
      return validate("QualifierInput", {
        profile: context.profile,
        audit: context.audit,
        campaign: context.campaign,
        offer: context.offer,
        template: context.template,
        evidence,
      });
    case "strategist":
      return validate("StrategistInput", {
        profile: context.profile,
        audit: context.audit,
        qualification: context.qualification,
        campaign: context.campaign,
        offer: context.offer,
        template: context.template,
        approved_assets: context.approvedAssets ?? [],
      });
    case "builder":
      return validate("BuilderInput", {
        brief: context.brief,
        facts: context.profile?.facts ?? [],
        contacts: context.profile?.contacts ?? [],
        template: context.template,
        approved_assets: context.approvedAssets ?? [],
        previous_site_spec:
          context.previousSiteSpec ?? context.siteSpec ?? null,
        repair_tasks: context.repairTasks ?? [],
      });
    case "qa": {
      const browser = context.browser ?? {};
      const browserImages = (browser.images ?? []).map((image: JsonObject) =>
        image.attachment_ref
          ? image
          : {
              evidence_id: image.evidence_id,
              attachment_ref: image.path,
              sha256: image.sha256,
              width: image.width,
              height: image.height,
            },
      );
      return validate("QAInput", {
        site_spec: context.siteSpec,
        facts: context.profile?.facts ?? [],
        contacts: context.profile?.contacts ?? [],
        brief: context.brief,
        audit_issues: context.audit?.issues ?? [],
        build: browser.build ?? context.build,
        test_results: browser.results ?? [],
        required_checks: browser.requiredChecks ?? [],
        approved_assets: context.approvedAssets ?? [],
        evidence: browser.evidence ?? evidence,
        images: browserImages,
      });
    }
    case "sales":
      return validate("SalesInput", {
        facts: context.profile?.facts ?? context.facts ?? [],
        approved_improvements: context.approved_improvements ?? [],
        preview: context.preview,
        agency: context.agency,
        offer: context.offer,
        recipient: context.recipient,
        evidence,
      });
  }
}
function scout(): JsonObject {
  return {
    data: {
      facts: [
        ["company_name", "Alpina Sanitär GmbH", "e-name"],
        ["country", "CH", "e-name"],
        ["locality", "Zürich", "e-name"],
        ["industry", "Sanitär", "e-services"],
        ["service", "Sanitärinstallationen", "e-services"],
        ["website_goal", "Beratung anfragen", "e-goal"],
        ["price", "CHF 12’000", "e-budget"],
      ].map(([field, value, evidence_id]) => ({
        field,
        value,
        evidence_ids: [evidence_id],
        interpretation: "source_reported",
      })),
      contacts: [
        {
          kind: "email",
          value: "hallo@alpina-sanitaer.example",
          evidence_ids: ["e-contact"],
        },
        { kind: "phone", value: "044 555 01 02", evidence_ids: ["e-contact"] },
        {
          kind: "contact_page",
          value: "https://fixture.alpina-service.example/kontakt",
          evidence_ids: ["e-contact"],
        },
      ],
      pages: [
        {
          page_ref: "page-home",
          url: "https://fixture.alpina-service.example/",
          kind: "home",
          evidence_ids: ["e-name"],
        },
        {
          page_ref: "page-contact",
          url: "https://fixture.alpina-service.example/kontakt",
          kind: "contact",
          evidence_ids: ["e-contact"],
        },
      ],
      agency: {
        agency_name: "Werkstatt Nord",
        relationship: "explicit_website_implementation",
        evidence_ids: ["e-credit"],
      },
      technology_signals: [],
      asset_candidates: [],
      brand_observations: [],
      contradictions: [],
    },
    gaps: [],
    notices: [],
  };
}
function audit(): JsonObject {
  const d = (level: string, evidence_id: string, criteria: string) => ({
    level,
    evidence_ids: [evidence_id],
    checked_criteria: [criteria],
    rationale: "Synthetisch beobachtet.",
  });
  return {
    data: {
      dimensions: {
        mobile_usability: d("major_friction", "e-mobile", "mobile navigation"),
        conversion: d("major_friction", "e-conversion", "visible CTA"),
        content_clarity: d(
          "minor_friction",
          "e-services",
          "service description",
        ),
        trust_transparency: d("minor_friction", "e-name", "identity"),
        technical_seo: d("minor_friction", "e-name", "page metadata"),
      },
      issues: [
        {
          category: "mobile_usability",
          severity: "major",
          observation: "Die Navigation verdeckt den Kontaktaufruf.",
          evidence_ids: ["e-mobile"],
          page_ref: "page-home",
          viewport: { width: 375, height: 800 },
          impact_hypothesis: "Der Aufruf ist schwer erreichbar.",
          recommendation: "Navigation kompakt darstellen.",
          suggested_fix_target: "site_spec",
          reproduction: ["Route / bei 375 px öffnen."],
        },
      ],
      strengths: [],
      limitations: [],
    },
    gaps: [],
    notices: [],
  };
}
function qualifier(input: JsonObject): JsonObject {
  const facts = input.profile.facts;
  const get = (field: string) =>
    facts.find((f: JsonObject) => f.field === field);
  const fit = {
    assessment: "supported",
    rule_ids: [],
    fact_ids: [get("industry").fact_id],
    evidence_ids: ["e-services"],
    checked_scope: ["home", "contact"],
    unresolved_dependencies: [],
    rationale: "Belegte lokale Sanitärleistung passt.",
  };
  const assessment = (level: string, fact: JsonObject) => ({
    level,
    evidence_ids: fact.evidence_ids,
    fact_ids: [fact.fact_id],
    rationale: "Belegter Fixture-Faktor.",
  });
  return {
    data: {
      offer_fit: fit,
      implementation_fit: fit,
      company_value: assessment("very_high", get("service")),
      budget_capacity: assessment("very_high", get("price")),
      website_importance: assessment("very_high", get("website_goal")),
      supporting_issue_ids: [input.audit.issues[0].issue_id],
      hard_exclusion_rule_ids: [],
      summary: "Synthetischer passender Fall.",
    },
    gaps: [],
    notices: [],
  };
}
const copy = (text: string, fact_ids: string[] = []) => ({
  text,
  kind: fact_ids.length ? "factual" : "editorial",
  fact_ids,
});
function strategist(input: JsonObject): JsonObject {
  const company = input.profile.facts.find(
    (f: JsonObject) => f.field === "company_name",
  );
  const service = input.profile.facts.find(
    (f: JsonObject) => f.field === "service",
  );
  const locality = input.profile.facts.find(
    (f: JsonObject) => f.field === "locality",
  );
  const issue = input.audit.issues[0].issue_id;
  return {
    data: {
      primary_goal: "Kontaktanfragen erleichtern",
      audience_assumptions: ["Lokale Kundschaft in Zürich"],
      design_rationale: "Klare Leistungen und ein gut sichtbarer Kontaktweg.",
      theme: {
        font_pair: "sans",
        palette: "brand",
        accent_hex: "#176b5b",
        spacing: "comfortable",
        motion: "subtle",
      },
      template_id: input.template.template_id,
      template_version: input.template.version,
      pages: [
        {
          route: "/",
          title: copy("Alpina Sanitär GmbH", [company.fact_id]),
          meta_description: copy("Sanitärinstallationen in Zürich", [
            service.fact_id,
            locality.fact_id,
          ]),
          sections: [
            {
              component: "hero",
              variant: "split",
              heading: copy("Sanitärinstallationen in Zürich", [
                service.fact_id,
                locality.fact_id,
              ]),
              body: [
                copy("Alpina Sanitär GmbH und Sanitärinstallationen.", [
                  company.fact_id,
                  service.fact_id,
                ]),
              ],
              items: [],
              cta: {
                label: copy("Kontakt ansehen"),
                target: "contact",
                target_ref: input.profile.contacts[0].contact_id,
              },
              asset_id: null,
              addressed_issue_ids: [issue],
            },
            {
              component: "services",
              variant: "cards",
              heading: copy("Leistungen"),
              body: [],
              items: [
                {
                  title: copy("Sanitärinstallationen", [service.fact_id]),
                  text: copy("Sanitärinstallationen.", [service.fact_id]),
                },
              ],
              cta: null,
              asset_id: null,
              addressed_issue_ids: [],
            },
            {
              component: "contact",
              variant: "stacked",
              heading: copy("Kontakt"),
              body: [copy("Kontaktangaben ansehen.")],
              items: [],
              cta: null,
              asset_id: null,
              addressed_issue_ids: [],
            },
          ],
        },
      ],
      asset_ids: [],
      migration_notes: [],
      open_questions: [],
      out_of_scope: [],
    },
    gaps: [],
    notices: [],
  };
}
function builder(input: JsonObject): JsonObject {
  const repairs = input.repair_tasks ?? [];
  const site =
    input.previous_site_spec && repairs.length
      ? structuredClone(input.previous_site_spec)
      : {
          template_id: input.brief.template_id,
          template_version: input.brief.template_version,
          locale: input.brief.locale,
          theme: input.brief.theme,
          navigation: input.brief.pages.map((p: JsonObject) => ({
            label: p.title,
            route: p.route,
          })),
          pages: input.brief.pages,
          asset_ids: input.brief.asset_ids,
          unresolved_requirements: input.brief.open_questions,
        };
  if (repairs.length) {
    const match = /^\/pages\/(\d+)\/sections\/(\d+)\/cta$/.exec(
      repairs[0].allowed_paths[0],
    );
    if (match && site.pages[Number(match[1])].sections[Number(match[2])].cta) {
      const cta = site.pages[Number(match[1])].sections[Number(match[2])].cta;
      cta.label = copy(
        cta.label.text === "Kontakt kontaktieren"
          ? "Kontakt ansehen"
          : "Kontakt kontaktieren",
      );
    }
  }
  return {
    data: {
      site_spec: site,
      change_log: repairs.length
        ? repairs.map((task: JsonObject) => ({
            issue_id: task.issue_id,
            path: task.allowed_paths[0],
            description: "Die begrenzte Fixture-Reparatur wurde angewendet.",
            expected_effect: task.expected_effect,
          }))
        : site.pages.flatMap((p: JsonObject) =>
            p.sections.flatMap((s: JsonObject) =>
              s.addressed_issue_ids.map((issue_id: string) => ({
                issue_id,
                path: `${p.route}#${s.section_id}`,
                description:
                  "Die Sektion setzt die empfohlene Verbesserung um.",
                expected_effect: "Der Kontaktweg ist klarer sichtbar.",
              })),
            ),
          ),
    },
    gaps: [],
    notices: [],
  };
}
function qa(input: JsonObject): JsonObject {
  const checks = input.required_checks
    .filter((c: JsonObject) => c.executor === "qa_model")
    .map((c: JsonObject) => {
      const image = input.images.find(
        (x: JsonObject) => !c.viewport || x.width === c.viewport.width,
      );
      return {
        check_id: c.check_id,
        result: image ? "pass" : "not_tested",
        evidence_ids: image ? [image.evidence_id] : [],
        detail: image
          ? "Simulierte visuelle Fixture-Beurteilung auf dem tatsächlich erzeugten Screenshot; Runtime-Checks bleiben tatsächlich ausgeführt."
          : "Kein passender tatsächlicher Screenshot vorhanden.",
      };
    });
  return {
    data: {
      checks,
      issues: [],
      resolved_audit_issue_ids: input.audit_issues.map(
        (x: JsonObject) => x.issue_id,
      ),
      limitations: [
        "Visuelle Bewertung ist im Fixture-Modus explizit simuliert.",
      ],
      summary: "Fixture-QA ohne erfundene Runtime-Ergebnisse.",
    },
    gaps: [],
    notices: [],
  };
}
function browser(input: JsonObject): JsonObject {
  const evidence = [
    ev(
      "e-runtime",
      "Actual browser fixture check supplied by integration harness.",
    ),
  ];
  return {
    build: {
      artifact_hash: hash(input.siteSpec),
      renderer_version: "fixture",
      result: "pass",
      evidence_ids: ["e-runtime"],
    },
    results: [
      {
        check_id: "runtime-build",
        result: "pass",
        evidence_ids: ["e-runtime"],
        detail: "Actual deterministic check passed.",
      },
    ],
    requiredChecks: [
      {
        check_id: "runtime-build",
        category: "build",
        executor: "runtime",
        page_ref: null,
        viewport: null,
      },
      {
        check_id: "visual-home-375",
        category: "visual",
        executor: "qa_model",
        page_ref: "/",
        viewport: { width: 375, height: 800 },
      },
    ],
    evidence,
    images: [
      {
        path: "fixture-qa.png",
        evidence_id: "e-runtime",
        width: 375,
        height: 800,
        sha256: hash("fixture-qa"),
      },
    ],
  };
}
function sales(input: JsonObject): JsonObject {
  const service = input.facts.find((f: JsonObject) => f.field === "service");
  return {
    data: {
      subject_options: [
        "Gestaltungsvorschlag für Alpina Sanitär GmbH",
        "Ihre Kontaktseite im Vorschlag",
      ],
      body_paragraphs: [
        {
          text: "Sanitärinstallationen.",
          kind: "factual",
          fact_ids: [service.fact_id],
          improvement_issue_ids: [],
          operator_fields: [],
        },
        {
          text: "Darf ich Ihnen den Vorschlag kurz vorstellen?",
          kind: "editorial",
          fact_ids: [],
          improvement_issue_ids: [],
          operator_fields: [],
        },
      ],
      referenced_issue_ids: [],
      personalization_notes: [],
    },
    gaps: [],
    notices: [],
  };
}
export function fixtureOutput(
  agent: AgentName | "sales-input" | "browser",
  input: JsonObject,
): JsonObject {
  if (agent === "sales-input") {
    const profile =
      input.profile ??
      (() => {
        throw new Error("sales fixture needs profile");
      })();
    return buildAgentInput("sales", {
      ...input,
      profile,
      approved_improvements: [],
      preview: {
        preview_url: "https://preview.fixture.example/token",
        artifact_hash: hash("preview"),
        locale: "de-CH",
      },
      agency: {
        name: "POLIRE",
        sender_name: "POLIRE",
        signature: "",
        required_notice: "",
      },
      recipient: { salutation: null },
    });
  }
  if (agent === "browser") return browser(input);
  const output =
    agent === "scout"
      ? scout()
      : agent === "audit"
        ? audit()
        : agent === "qualifier"
          ? qualifier(input)
          : agent === "strategist"
            ? strategist(input)
            : agent === "builder"
              ? builder(input)
              : agent === "qa"
                ? qa(input)
                : sales(input);
  return validate(
    `${agent === "qa" ? "QA" : agent[0].toUpperCase() + agent.slice(1)}Output`,
    output,
  );
}
