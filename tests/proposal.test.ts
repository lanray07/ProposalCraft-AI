import { describe, expect, it } from "vitest";
import {
  explainProposal,
  generateProposal,
  getTemplates,
  regenerateProposal
} from "../src/core/proposal.js";
import type { ProposalSection } from "../src/core/types.js";

const baseInput = {
  projectDescription:
    "clean a three bedroom home after renovation with focus on kitchen, bathrooms, floors, and dust removal",
  serviceType: "cleaning" as const,
  price: 680,
  timeline: "One full working day",
  tone: "friendly" as const
};

describe("proposal generation", () => {
  it("generates a complete deterministic proposal", () => {
    const proposal = generateProposal(baseInput);

    expect(proposal.title).toBe("Cleaning Proposal");
    expect(proposal.sections.map((section: ProposalSection) => section.title)).toEqual([
      "Project Overview",
      "Scope of Work",
      "Timeline",
      "Pricing Summary",
      "Payment Terms",
      "Assumptions",
      "Optional Upsells",
      "Approval"
    ]);
    expect(proposal.pricingSummary).toContain("$680");
    expect(proposal.clientReadyProposal).toContain("## Scope of Work");
    expect(proposal.optionalUpsells).toContain("Deep clean add-on");
  });

  it("rejects invalid project details", () => {
    expect(() =>
      generateProposal({
        ...baseInput,
        projectDescription: "too short"
      })
    ).toThrow("Project description");
  });

  it("adds a tracked revision note when regenerating", () => {
    const proposal = regenerateProposal({
      ...baseInput,
      revisionNote: "make clear that windows are excluded"
    });

    expect(proposal.assumptions.at(-1)).toBe(
      "Revision note considered: Make clear that windows are excluded"
    );
    expect(proposal.clientReadyProposal).toContain("windows are excluded");
  });

  it("adds proposal details and deposit terms when supplied", () => {
    const proposal = generateProposal({
      ...baseInput,
      businessName: "Bright Finish Cleaning",
      clientName: "Acme Offices",
      depositPercent: 25
    });

    expect(proposal.title).toBe("Cleaning Proposal for Acme Offices");
    expect(proposal.sections.at(0)?.title).toBe("Proposal Details");
    expect(proposal.clientReadyProposal).toContain(
      "Prepared by: Bright Finish Cleaning"
    );
    expect(proposal.clientReadyProposal).toContain("Prepared for: Acme Offices");
    expect(proposal.clientReadyProposal).toContain(
      "25% deposit due on approval: $170"
    );
    expect(proposal.clientReadyProposal).toContain(
      "Estimated remaining balance: $510"
    );
  });

  it("explains the template rules", () => {
    const explanation = explainProposal("paving", "premium");

    expect(explanation.templateUsed).toBe("paving");
    expect(explanation.deterministicRules).toContain(
      "Return a fixed client-ready section order."
    );
  });

  it("ships the required service templates", () => {
    expect(Object.keys(getTemplates()).sort()).toEqual([
      "cleaning",
      "general-contractor",
      "landscaping",
      "paving"
    ]);
  });

  it("keeps each service template detailed enough for client-ready output", () => {
    const templates = getTemplates();

    for (const template of Object.values(templates)) {
      expect(template.scopeItems.length).toBeGreaterThanOrEqual(6);
      expect(template.paymentTerms.length).toBeGreaterThanOrEqual(3);
      expect(template.assumptions.length).toBeGreaterThanOrEqual(4);
      expect(template.upsells.length).toBeGreaterThanOrEqual(5);
    }
  });
});
