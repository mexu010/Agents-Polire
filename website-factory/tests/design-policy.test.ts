import { describe, expect, it } from "vitest";
import { validateDesignPlan } from "../src/design-policy.js";
import {
  fixtureInput,
  buildAgentInput,
  fixtureOutput,
} from "../src/fixtures.js";
import { processAgentOutput } from "../src/agents.js";

const research = () => ({
  status: "complete",
  industry: "salon",
  query: "salon website",
  source_mode: "catalog",
  captured_at: new Date().toISOString(),
  references: [
    {
      reference_id: "ref-1",
      url: "https://salon.example/",
      title: "Reference",
      excerpt: "Booking and services",
      evidence_ids: ["e-1"],
      image_evidence_ids: ["img-1"],
    },
  ],
  gaps: [],
  recent_designs: [],
});
const brief = () => ({
  theme: { composition: "atelier", font_pair: "editorial" },
  pages: [
    {
      sections: [
        { component: "hero" },
        { component: "services" },
        { component: "contact" },
      ],
    },
  ],
  design_plan: {
    concept: "Quiet salon portrait",
    reference_ids: ["ref-1"],
    observations: [
      {
        reference_id: "ref-1",
        basis: "visual",
        takeaway: "Asymmetric image placement",
        application: "Portrait beside compact introduction",
      },
    ],
    alternatives: [
      { composition: "bold", reason: "Too loud for the intended mood" },
      { composition: "minimal", reason: "Would underuse the approved imagery" },
    ],
    avoid: ["Generic three-card hero"],
    originality_note: "Use a different hierarchy and own approved images",
  },
});

describe("design direction policy", () => {
  it("requires a researched plan for new inputs and keeps old briefs valid", () => {
    expect(() => validateDesignPlan({}, {})).not.toThrow();
    expect(() =>
      validateDesignPlan({}, { design_research: research() }),
    ).toThrow(/design/i);
    expect(() =>
      validateDesignPlan(brief(), { design_research: research() }),
    ).not.toThrow();
  });
  it("rejects invented reference IDs and claims of seeing missing images", () => {
    const data = brief();
    data.design_plan.reference_ids = ["invented"];
    expect(() =>
      validateDesignPlan(data, { design_research: research() }),
    ).toThrow(/reference/i);
    const packet = research();
    packet.references[0].image_evidence_ids = [];
    expect(() =>
      validateDesignPlan(brief(), { design_research: packet }),
    ).toThrow(/image/i);
  });
  it("binds visual observations to delivered screenshot images for current inputs", () => {
    const packet = research();
    const current = {
      design_research: packet,
      images: [
        {
          evidence_id: "img-1",
          attachment_ref: "reference.png",
          sha256: "abc",
          width: 1440,
          height: 1000,
        },
      ],
      evidence: [{ evidence_id: "img-1", kind: "screenshot" }],
    };
    expect(() => validateDesignPlan(brief(), current)).not.toThrow();
    expect(() =>
      validateDesignPlan(brief(), { ...current, images: [] }),
    ).toThrow(/delivered screenshot/i);
    expect(() =>
      validateDesignPlan(brief(), {
        ...current,
        evidence: [{ evidence_id: "img-1", kind: "html" }],
      }),
    ).toThrow(/delivered screenshot/i);
    expect(() =>
      validateDesignPlan(brief(), {
        ...current,
        images: [{ ...current.images[0], evidence_id: "another-image" }],
      }),
    ).toThrow(/delivered screenshot/i);
  });
  it("requires two genuinely different alternatives and rejects a colour-only repeat", () => {
    const data = brief();
    data.design_plan.alternatives[0].composition = "atelier";
    expect(() =>
      validateDesignPlan(data, { design_research: research() }),
    ).toThrow(/alternative/i);
    const packet: any = research();
    packet.recent_designs = [
      {
        composition: "atelier",
        font_pair: "editorial",
        section_order: ["hero", "services", "contact"],
      },
    ];
    expect(() =>
      validateDesignPlan(brief(), { design_research: packet }),
    ).toThrow(/repeat/i);
    const changedFont = brief();
    changedFont.theme.font_pair = "sans";
    expect(() =>
      validateDesignPlan(changedFont, { design_research: packet }),
    ).toThrow(/repeat/i);
    data.theme.composition = "editorial";
    expect(() =>
      validateDesignPlan(data, { design_research: packet }),
    ).not.toThrow();
  });
  it("prevents Builder from silently discarding the chosen composition", () => {
    const context: any = fixtureInput();
    for (const agent of [
      "scout",
      "audit",
      "qualifier",
      "strategist",
    ] as const) {
      const input = buildAgentInput(agent, context);
      const key = {
        scout: "profile",
        audit: "audit",
        qualifier: "qualification",
        strategist: "brief",
      }[agent];
      context[key] = processAgentOutput(
        agent,
        fixtureOutput(agent, input),
        input,
      );
    }
    context.brief.theme.composition = "editorial";
    const input = buildAgentInput("builder", context);
    const output = fixtureOutput("builder", input);
    output.data.site_spec.theme = {
      ...output.data.site_spec.theme,
      composition: "bold",
    };
    expect(() => processAgentOutput("builder", output, input)).toThrow(
      /composition/i,
    );
  });
});
