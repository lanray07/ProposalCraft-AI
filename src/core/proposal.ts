import templates from "../templates/proposal-templates.json" with { type: "json" };
import {
  type Proposal,
  type ProposalExplanation,
  type ProposalInput,
  type RegenerateProposalInput,
  type ServiceTemplate,
  type ServiceType,
  type TemplateRegistry,
  type Tone
} from "./types.js";
import {
  formatZodError,
  proposalInputSchema,
  regenerateProposalInputSchema
} from "./validation.js";

const templateRegistry = templates as TemplateRegistry;

const toneCopy: Record<Tone, { greeting: string; promise: string; close: string }> = {
  formal: {
    greeting: "Thank you for the opportunity to provide this proposal.",
    promise: "The following scope is structured to define expectations clearly and support a smooth delivery process.",
    close: "We would be pleased to proceed upon written approval of this proposal."
  },
  friendly: {
    greeting: "Thanks for sharing the project details.",
    promise: "This proposal keeps the work clear, practical, and easy to move forward with.",
    close: "We are ready to get started once you are happy with the plan."
  },
  premium: {
    greeting: "Thank you for considering us for this project.",
    promise: "This proposal is designed around a polished finish, clear communication, and a dependable client experience.",
    close: "Upon approval, we will reserve the schedule and prepare the project for a refined delivery."
  }
};

export function getTemplates(): TemplateRegistry {
  return templateRegistry;
}

export function getTemplate(serviceType: ServiceType): ServiceTemplate {
  return templateRegistry[serviceType];
}

export function generateProposal(input: ProposalInput): Proposal {
  const parsed = proposalInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  return buildProposal(parsed.data);
}

export function regenerateProposal(input: RegenerateProposalInput): Proposal {
  const parsed = regenerateProposalInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  const proposal = buildProposal(parsed.data);

  if (!parsed.data.revisionNote) {
    return proposal;
  }

  const revisedAssumptions = [
    ...proposal.assumptions,
    `Revision note considered: ${sentenceCase(parsed.data.revisionNote)}`
  ];

  return assembleProposal({
    ...proposal,
    assumptions: revisedAssumptions
  });
}

export function explainProposal(
  serviceType: ServiceType,
  tone: Tone = "formal"
): ProposalExplanation {
  const template = getTemplate(serviceType);

  return {
    summary: `ProposalCraft AI uses the ${template.label} template with a ${tone} tone to produce the same section order every time.`,
    templateUsed: serviceType,
    deterministicRules: [
      "Validate required fields before formatting.",
      "Use the selected service template for scope, assumptions, terms, and upsells.",
      "Apply tone only to the overview and closing language.",
      "Format pricing from the numeric input without estimating hidden costs.",
      "Return a fixed client-ready section order."
    ],
    includedSections: [
      "Project Overview",
      "Scope of Work",
      "Timeline",
      "Pricing Summary",
      "Payment Terms",
      "Assumptions",
      "Optional Upsells",
      "Approval"
    ]
  };
}

function buildProposal(input: ProposalInput): Proposal {
  const template = getTemplate(input.serviceType);
  const copy = toneCopy[input.tone];
  const cleanedDescription = sentenceCase(input.projectDescription);
  const clientPrefix = input.clientName ? ` for ${input.clientName}` : "";
  const projectOverview = `${copy.greeting} This ${template.overviewLead} covers: ${cleanedDescription} ${copy.promise}`;
  const pricingSummary = `Total proposed price${clientPrefix}: ${formatCurrency(input.price)}. This price is based on the project details provided and the assumptions listed below.`;
  const depositSummary = createDepositSummary(input.price, input.depositPercent);

  const proposal: Proposal = {
    title: createTitle(template.label, input.clientName),
    businessName: input.businessName,
    clientName: input.clientName,
    serviceLabel: template.label,
    tone: input.tone,
    projectOverview,
    scopeOfWork: createScope(template, cleanedDescription),
    timeline: input.timeline,
    pricingSummary,
    depositSummary,
    paymentTerms: template.paymentTerms,
    assumptions: template.assumptions,
    optionalUpsells: template.upsells,
    clientReadyProposal: "",
    sections: []
  };

  return assembleProposal(proposal);
}

function assembleProposal(proposal: Proposal): Proposal {
  const sections = [
    ...(proposal.businessName || proposal.clientName
      ? [
          {
            title: "Proposal Details",
            body: [
              ...(proposal.businessName ? [`Prepared by: ${proposal.businessName}`] : []),
              ...(proposal.clientName ? [`Prepared for: ${proposal.clientName}`] : [])
            ]
          }
        ]
      : []),
    { title: "Project Overview", body: proposal.projectOverview },
    { title: "Scope of Work", body: proposal.scopeOfWork },
    { title: "Timeline", body: proposal.timeline },
    { title: "Pricing Summary", body: proposal.pricingSummary },
    {
      title: "Payment Terms",
      body: proposal.depositSummary
        ? [proposal.depositSummary, ...proposal.paymentTerms]
        : proposal.paymentTerms
    },
    { title: "Assumptions", body: proposal.assumptions },
    { title: "Optional Upsells", body: proposal.optionalUpsells },
    { title: "Approval", body: toneCopy[proposal.tone].close }
  ];

  return {
    ...proposal,
    sections,
    clientReadyProposal: formatClientProposal(proposal.title, sections)
  };
}

function createScope(template: ServiceTemplate, description: string): string[] {
  return [`Project-specific work: ${description}`, ...template.scopeItems];
}

function formatClientProposal(
  title: string,
  sections: Proposal["sections"]
): string {
  const body = sections
    .map((section) => {
      const content = Array.isArray(section.body)
        ? section.body.map((item) => `- ${item}`).join("\n")
        : section.body;

      return `## ${section.title}\n${content}`;
    })
    .join("\n\n");

  return `# ${title}\n\n${body}`;
}

function createTitle(serviceLabel: string, clientName?: string): string {
  return clientName
    ? `${serviceLabel} Proposal for ${clientName}`
    : `${serviceLabel} Proposal`;
}

function createDepositSummary(
  price: number,
  depositPercent: number | undefined
): string | undefined {
  if (!depositPercent) {
    return undefined;
  }

  const depositAmount = price * (depositPercent / 100);
  const balance = price - depositAmount;

  return `${depositPercent}% deposit due on approval: ${formatCurrency(depositAmount)}. Estimated remaining balance: ${formatCurrency(balance)}.`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function sentenceCase(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
