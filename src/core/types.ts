export const serviceTypes = [
  "landscaping",
  "paving",
  "cleaning",
  "general-contractor",
  "painting",
  "plumbing",
  "electrical",
  "handyman",
  "pressure-washing",
  "roofing"
] as const;

export const tones = ["formal", "friendly", "premium"] as const;

export type ServiceType = (typeof serviceTypes)[number];
export type Tone = (typeof tones)[number];

export type ProposalInput = {
  businessName?: string;
  clientName?: string;
  projectDescription: string;
  serviceType: ServiceType;
  price: number;
  depositPercent?: number;
  timeline: string;
  tone: Tone;
};

export type RegenerateProposalInput = ProposalInput & {
  revisionNote?: string;
};

export type ProposalSection = {
  title: string;
  body: string | string[];
};

export type Proposal = {
  title: string;
  businessName?: string;
  clientName?: string;
  serviceLabel: string;
  tone: Tone;
  projectOverview: string;
  scopeOfWork: string[];
  timeline: string;
  pricingSummary: string;
  depositSummary?: string;
  paymentTerms: string[];
  assumptions: string[];
  optionalUpsells: string[];
  followUpEmail: string;
  clientReadyProposal: string;
  sections: ProposalSection[];
};

export type ProposalExplanation = {
  summary: string;
  templateUsed: ServiceType;
  deterministicRules: string[];
  includedSections: string[];
};

export type ServiceTemplate = {
  label: string;
  overviewLead: string;
  scopeItems: string[];
  paymentTerms: string[];
  assumptions: string[];
  upsells: string[];
};

export type TemplateRegistry = Record<ServiceType, ServiceTemplate>;
