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
  "roofing",
  "hvac",
  "flooring",
  "remodeling",
  "moving",
  "pest-control",
  "pool-service",
  "appliance-repair",
  "junk-removal"
] as const;

export const tones = ["formal", "friendly", "premium"] as const;

export type ServiceType = (typeof serviceTypes)[number];
export type Tone = (typeof tones)[number];

export type ProposalInput = {
  businessName?: string;
  contactName?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  licenseNote?: string;
  preparedDate?: string;
  proposalId?: string;
  clientName?: string;
  projectDescription: string;
  serviceType: ServiceType;
  price: number;
  pricingBreakdown?: PricingLine[];
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

export type ProposalOption = {
  name: string;
  price: number;
  summary: string;
  includes: string[];
};

export type PricingLine = {
  label: string;
  amount: number;
};

export type ProposalDetails = {
  preparedBy?: string;
  preparedFor?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  licenseNote?: string;
  preparedDate: string;
  proposalId: string;
};

export type Proposal = {
  title: string;
  businessName?: string;
  clientName?: string;
  details: ProposalDetails;
  serviceLabel: string;
  tone: Tone;
  projectOverview: string;
  scopeOfWork: string[];
  timeline: string;
  pricingSummary: string;
  pricingBreakdown: PricingLine[];
  depositSummary?: string;
  paymentTerms: string[];
  assumptions: string[];
  optionalUpsells: string[];
  proposalOptions: ProposalOption[];
  approvalText: string[];
  nextSteps: string[];
  clientEmail: string;
  approvalMessage: string;
  followUpEmail: string;
  clientReadyProposal: string;
  plainTextProposal: string;
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
