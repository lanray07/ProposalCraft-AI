import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  explainProposal,
  generateProposal,
  regenerateProposal
} from "../core/proposal.js";
import { generateProposalPdf } from "../core/pdf.js";
import {
  explainProposalInputSchema,
  proposalInputSchema,
  regenerateProposalInputSchema
} from "../core/validation.js";
import {
  debugWidgetUri,
  getBaseUrl,
  getDebugWidgetHtml,
  getWidgetHtml,
  widgetMimeType,
  widgetUri
} from "./widget.js";

const proposalInputJsonSchema: Tool["inputSchema"] = {
  type: "object",
  properties: {
    businessName: {
      type: "string",
      description: "Optional service provider or company name to show in proposal details."
    },
    contactName: {
      type: "string",
      description: "Optional person preparing or sending the proposal."
    },
    businessPhone: {
      type: "string",
      description: "Optional business phone number for the proposal details."
    },
    businessEmail: {
      type: "string",
      description: "Optional business email address for the proposal details."
    },
    businessWebsite: {
      type: "string",
      description: "Optional business website for the proposal details."
    },
    licenseNote: {
      type: "string",
      description:
        "Optional license, insurance, certification, or bonding note to include in proposal details."
    },
    preparedDate: {
      type: "string",
      description:
        "Optional prepared date. If omitted, ProposalCraft AI uses the current date."
    },
    proposalId: {
      type: "string",
      description:
        "Optional proposal ID. If omitted, ProposalCraft AI creates a deterministic ID from the title and date."
    },
    clientName: {
      type: "string",
      description: "Optional client name to personalize the proposal title and details."
    },
    projectDescription: {
      type: "string",
      description:
        "Plain-language project details such as property type, requested work, size, materials, special requirements, and client priorities."
    },
    serviceType: {
      type: "string",
      enum: [
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
      ],
      description: "The reusable service template to apply."
    },
    price: {
      type: "number",
      minimum: 0,
      description: "Total proposed price supplied by the user."
    },
    pricingBreakdown: {
      type: "array",
      description:
        "Optional itemized pricing lines supplied by the user. The total price remains the controlling proposed price.",
      items: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description: "Line-item label such as Labor, Materials, Disposal, or Travel."
          },
          amount: {
            type: "number",
            minimum: 0,
            description: "Line-item amount supplied by the user."
          }
        },
        required: ["label", "amount"],
        additionalProperties: false
      },
      maxItems: 12
    },
    depositPercent: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description:
        "Optional deposit percentage to calculate a deposit and remaining balance."
    },
    timeline: {
      type: "string",
      description: "Expected schedule, duration, or start/completion window."
    },
    tone: {
      type: "string",
      enum: ["formal", "friendly", "premium"],
      description: "Client-facing tone to use for controlled framing copy."
    }
  },
  required: ["projectDescription", "serviceType", "price", "timeline", "tone"],
  additionalProperties: false
};

const regenerateInputJsonSchema: Tool["inputSchema"] = {
  ...proposalInputJsonSchema,
  properties: {
    ...proposalInputJsonSchema.properties,
    revisionNote: {
      type: "string",
      description:
        "Optional deterministic revision instruction to include as a tracked assumption."
    }
  }
};

const explainInputJsonSchema: Tool["inputSchema"] = {
  type: "object",
  properties: {
    serviceType: {
      type: "string",
      enum: [
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
      ]
    },
    tone: {
      type: "string",
      enum: ["formal", "friendly", "premium"]
    }
  },
  required: ["serviceType"],
  additionalProperties: false
};

function descriptorMeta(invoking: string, invoked: string, resourceUri = widgetUri) {
  return {
    ui: {
      resourceUri
    },
    "openai/outputTemplate": resourceUri,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true
  } as const;
}

function resourceMeta() {
  const baseUrl = getBaseUrl();
  const allowedDomains = Array.from(
    new Set([
      baseUrl,
      "https://proposalcraft-ai-blue.vercel.app",
      "https://proposalcraft-ai-lanraybanks-9759s-projects.vercel.app"
    ])
  );

  return {
    ui: {
      prefersBorder: true,
      domain: baseUrl,
      csp: {
        connectDomains: allowedDomains,
        resourceDomains: allowedDomains
      }
    },
    "openai/widgetDescription":
      "A compact proposal builder for service businesses with form inputs and a copy-ready proposal card.",
    "openai/widgetPrefersBorder": true,
    "openai/widgetDomain": baseUrl,
    "openai/widgetCSP": {
      connect_domains: allowedDomains,
      resource_domains: allowedDomains
    }
  } as const;
}

const tools: Tool[] = [
  {
    name: "generateProposal",
    title: "Generate Proposal",
    description:
      "Generate a structured, client-ready service proposal from job details, price, timeline, service type, and tone.",
    inputSchema: proposalInputJsonSchema,
    _meta: descriptorMeta("Drafting proposal", "Proposal drafted"),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "generateProposalPdf",
    title: "Generate Proposal PDF",
    description:
      "Generate a structured service proposal and return a client-ready PDF attachment.",
    inputSchema: proposalInputJsonSchema,
    _meta: descriptorMeta("Creating proposal PDF", "Proposal PDF created"),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "downloadProposalPdf",
    title: "Download Proposal PDF",
    description:
      "Return only the deterministic ProposalCraft PDF attachment for a service proposal, without rewriting or summarizing the proposal text.",
    inputSchema: proposalInputJsonSchema,
    _meta: descriptorMeta("Preparing proposal PDF", "Proposal PDF ready"),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "regenerateProposal",
    title: "Regenerate Proposal",
    description:
      "Regenerate a proposal using the same deterministic template rules, optionally tracking a revision note.",
    inputSchema: regenerateInputJsonSchema,
    _meta: descriptorMeta("Regenerating proposal", "Proposal regenerated"),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "explainProposal",
    title: "Explain Proposal",
    description:
      "Explain which template and deterministic rules ProposalCraft AI uses for a proposal.",
    inputSchema: explainInputJsonSchema,
    _meta: descriptorMeta("Explaining proposal", "Proposal explained"),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "debugWidget",
    title: "Show Debug Widget",
    description:
      "Render a minimal hardcoded ProposalCraft widget to verify ChatGPT can load the app resource.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    _meta: descriptorMeta("Loading debug widget", "Debug widget loaded", debugWidgetUri),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  }
];

const resources: Resource[] = [
  {
    name: "ProposalCraft AI",
    uri: widgetUri,
    description: "ProposalCraft AI React widget",
    mimeType: widgetMimeType,
    _meta: resourceMeta()
  },
  {
    name: "ProposalCraft AI Debug",
    uri: debugWidgetUri,
    description: "Minimal ProposalCraft AI debug widget",
    mimeType: widgetMimeType,
    _meta: resourceMeta()
  }
];

const resourceTemplates: ResourceTemplate[] = [
  {
    name: "ProposalCraft AI",
    uriTemplate: widgetUri,
    description: "ProposalCraft AI React widget template",
    mimeType: widgetMimeType,
    _meta: resourceMeta()
  },
  {
    name: "ProposalCraft AI Debug",
    uriTemplate: debugWidgetUri,
    description: "Minimal ProposalCraft AI debug widget template",
    mimeType: widgetMimeType,
    _meta: resourceMeta()
  }
];

export function createProposalCraftServer(): Server {
  const server = new Server(
    {
      name: "proposalcraft-ai",
      version: "0.1.0"
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => ({ resources })
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const requestedUri = request.params.uri;

      return {
        contents: [
          {
            uri: requestedUri,
            mimeType: widgetMimeType,
            text:
              requestedUri === debugWidgetUri
                ? getDebugWidgetHtml()
                : getWidgetHtml(),
            _meta: resourceMeta()
          }
        ]
      };
    }
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (_request: ListResourceTemplatesRequest) => ({ resourceTemplates })
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => ({ tools })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => callTool(request)
  );

  return server;
}

function callTool(request: CallToolRequest) {
  try {
    if (request.params.name === "generateProposal") {
      const args = proposalInputSchema.parse(request.params.arguments ?? {});
      const proposal = generateProposal(args);

      return {
        content: [
          { type: "text" as const, text: proposal.clientReadyProposal },
          widgetResourceContent()
        ],
        structuredContent: { proposal },
        _meta: descriptorMeta("Drafting proposal", "Proposal drafted")
      };
    }

    if (request.params.name === "generateProposalPdf") {
      const args = proposalInputSchema.parse(request.params.arguments ?? {});
      const pdf = generateProposalPdf(args);

      return {
        content: [
          {
            type: "text" as const,
            text: `Created ${pdf.filename} (${pdf.byteLength} bytes).`
          },
          {
            type: "resource" as const,
            resource: {
              uri: `file:///${pdf.filename}`,
              mimeType: pdf.mimeType,
              blob: pdf.base64,
              _meta: {
                filename: pdf.filename
              }
            }
          }
        ],
        structuredContent: {
          proposal: pdf.proposal,
          pdf: {
            filename: pdf.filename,
            mimeType: pdf.mimeType,
            byteLength: pdf.byteLength
          }
        },
        _meta: descriptorMeta("Creating proposal PDF", "Proposal PDF created")
      };
    }

    if (request.params.name === "downloadProposalPdf") {
      const args = proposalInputSchema.parse(request.params.arguments ?? {});
      const pdf = generateProposalPdf(args);

      return {
        content: [
          {
            type: "text" as const,
            text: `Attached ${pdf.filename}.`
          },
          {
            type: "resource" as const,
            resource: {
              uri: `file:///${pdf.filename}`,
              mimeType: pdf.mimeType,
              blob: pdf.base64,
              _meta: {
                filename: pdf.filename
              }
            }
          }
        ],
        structuredContent: {
          pdf: {
            filename: pdf.filename,
            mimeType: pdf.mimeType,
            byteLength: pdf.byteLength
          }
        },
        _meta: descriptorMeta("Preparing proposal PDF", "Proposal PDF ready")
      };
    }

    if (request.params.name === "regenerateProposal") {
      const args = regenerateProposalInputSchema.parse(
        request.params.arguments ?? {}
      );
      const proposal = regenerateProposal(args);

      return {
        content: [
          { type: "text" as const, text: proposal.clientReadyProposal },
          widgetResourceContent()
        ],
        structuredContent: { proposal },
        _meta: descriptorMeta("Regenerating proposal", "Proposal regenerated")
      };
    }

    if (request.params.name === "explainProposal") {
      const args = explainProposalInputSchema.parse(
        request.params.arguments ?? {}
      );
      const explanation = explainProposal(args.serviceType, args.tone);

      return {
        content: [
          { type: "text" as const, text: explanation.summary },
          widgetResourceContent()
        ],
        structuredContent: { explanation },
        _meta: descriptorMeta("Explaining proposal", "Proposal explained")
      };
    }

    if (request.params.name === "debugWidget") {
      return {
        content: [
          {
            type: "text" as const,
            text: "Showing the ProposalCraft AI debug widget."
          },
          widgetResourceContent(debugWidgetUri)
        ],
        structuredContent: {
          message: "ProposalCraft AI debug widget should be visible."
        },
        _meta: descriptorMeta(
          "Loading debug widget",
          "Debug widget loaded",
          debugWidgetUri
        )
      };
    }
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(" ")
        : error instanceof Error
          ? error.message
          : "Unexpected proposal error.";

    return {
      isError: true,
      content: [{ type: "text" as const, text: message }],
      structuredContent: { error: message },
      _meta: descriptorMeta("Handling error", "Proposal error")
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
}

function widgetResourceContent(resourceUri = widgetUri) {
  return {
    type: "resource" as const,
    resource: {
      uri: resourceUri,
      mimeType: widgetMimeType,
      text: resourceUri === debugWidgetUri ? getDebugWidgetHtml() : getWidgetHtml(),
      _meta: resourceMeta()
    }
  };
}
