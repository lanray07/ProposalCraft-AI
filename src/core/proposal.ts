import templates from "../templates/proposal-templates.json" with { type: "json" };
import {
  type Proposal,
  type ProposalExplanation,
  type ProposalInput,
  type ProposalOption,
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
      "Create Good, Better, and Best options from fixed percentage adjustments.",
      "Return a fixed client-ready section order."
    ],
    includedSections: [
      "Project Overview",
      "Scope of Work",
      "Timeline",
      "Pricing Summary",
      "Proposal Options",
      "Payment Terms",
      "Assumptions",
      "Optional Upsells",
      "Follow-up Email",
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
  const proposalOptions = createProposalOptions(input.price, template);
  const depositSummary = createDepositSummary(input.price, input.depositPercent);
  const followUpEmail = createFollowUpEmail({
    businessName: input.businessName,
    clientName: input.clientName,
    proposalTitle: createTitle(template.label, input.clientName),
    price: input.price,
    timeline: input.timeline,
    tone: input.tone
  });

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
    proposalOptions,
    approvalText: createApprovalText(copy.close),
    followUpEmail,
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
      title: "Proposal Options",
      body: formatProposalOptions(proposal.proposalOptions)
    },
    {
      title: "Payment Terms",
      body: proposal.depositSummary
        ? [proposal.depositSummary, ...proposal.paymentTerms]
        : proposal.paymentTerms
    },
    { title: "Assumptions", body: proposal.assumptions },
    { title: "Optional Upsells", body: proposal.optionalUpsells },
    { title: "Follow-up Email", body: proposal.followUpEmail },
    { title: "Approval", body: proposal.approvalText }
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

function createProposalOptions(
  basePrice: number,
  template: ServiceTemplate
): ProposalOption[] {
  const firstUpsell = template.upsells[0] ?? "Priority scheduling";
  const secondUpsell = template.upsells[1] ?? "Premium materials or products";
  const thirdUpsell = template.upsells[2] ?? "Follow-up quality check";

  return [
    {
      name: "Good",
      price: basePrice,
      summary: "Core scope exactly as proposed.",
      includes: [
        "Agreed project-specific work",
        "Standard preparation and completion",
        "Routine cleanup and handover"
      ]
    },
    {
      name: "Better",
      price: roundMoney(basePrice * 1.15),
      summary: "Recommended option with added finish and convenience.",
      includes: [
        "Everything in Good",
        firstUpsell,
        "Priority scheduling where available"
      ]
    },
    {
      name: "Best",
      price: roundMoney(basePrice * 1.3),
      summary: "Premium option with the strongest handoff package.",
      includes: [
        "Everything in Better",
        secondUpsell,
        thirdUpsell
      ]
    }
  ];
}

function formatProposalOptions(options: ProposalOption[]): string[] {
  return options.map(
    (option) =>
      `${option.name} - ${formatCurrency(option.price)}: ${option.summary} Includes ${option.includes.join("; ")}.`
  );
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function createApprovalText(close: string): string[] {
  return [
    close,
    "Proposal valid for 14 days from the date issued unless updated in writing.",
    "Client approval: ______________________________",
    "Accepted date: ______________________________"
  ];
}

function createFollowUpEmail(input: {
  businessName?: string;
  clientName?: string;
  proposalTitle: string;
  price: number;
  timeline: string;
  tone: Tone;
}): string {
  const greeting = input.clientName ? `Hi ${input.clientName},` : "Hi,";
  const sender = input.businessName ? `\n\n${input.businessName}` : "";

  if (input.tone === "premium") {
    return `${greeting}\n\nThank you again for the opportunity to prepare this proposal. I have attached ${input.proposalTitle}, including the recommended scope, timeline, investment summary, assumptions, and optional enhancements.\n\nThe proposed price is ${formatCurrency(input.price)}, with an expected timeline of ${input.timeline}. Please review it when convenient, and I will be happy to answer questions or refine the scope before approval.${sender}`;
  }

  if (input.tone === "friendly") {
    return `${greeting}\n\nThanks again for sharing the project details. I have attached ${input.proposalTitle} with the scope, timeline, price, assumptions, and optional add-ons in one place.\n\nThe proposed price is ${formatCurrency(input.price)}, and the expected timeline is ${input.timeline}. Let me know what you think, and I can make any needed adjustments before we move forward.${sender}`;
  }

  return `${greeting}\n\nPlease find attached ${input.proposalTitle}. It includes the project overview, scope of work, timeline, pricing summary, payment terms, assumptions, and optional upsells for review.\n\nThe proposed price is ${formatCurrency(input.price)}, and the expected timeline is ${input.timeline}. Please confirm if you would like to proceed or if any revisions are required.${sender}`;
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
