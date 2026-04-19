# ProposalCraft AI

ProposalCraft AI is a ChatGPT app built with the OpenAI Apps SDK pattern: a React widget plus an MCP server that exposes proposal tools to ChatGPT. It generates structured, client-ready proposals for service businesses from a deterministic JSON template registry.

## What It Does

- Collects business name, contact details, client name, project description, service type, price, deposit percentage, timeline, and tone.
- Generates a fixed proposal structure with overview, scope, timeline, pricing, optional line-item breakdown, Good / Better / Best options, payment terms, assumptions, upsells, next steps, client email, approval message, follow-up email, and approval copy.
- Uses reusable JSON templates for landscaping, paving, cleaning, general contractor, painting, plumbing, electrical, handyman, pressure washing, roofing, HVAC, flooring, remodeling, moving, pest control, pool service, appliance repair, and junk removal jobs.
- Saves form inputs locally in the browser for faster repeat proposals.
- Supports copy, Markdown download, PDF attachment generation, print-to-PDF, and follow-up email copy actions.
- Exposes four ChatGPT proposal tools: `generateProposal`, `generateProposalPdf`, `regenerateProposal`, and `explainProposal`.
- Runs locally as a Vite React app and an MCP server, and includes Vercel configuration.

## Tech Stack

- Node.js 20+
- TypeScript
- React
- Vite
- `@modelcontextprotocol/sdk`
- OpenAI Apps SDK widget metadata (`text/html+skybridge`, `openai/outputTemplate`, `window.openai`)
- Vercel-ready API entrypoint

## Setup

```bash
npm install
npm run build
```

Run the widget preview:

```bash
npm run dev
```

Run the MCP server:

```bash
npm run dev:mcp
```

The local MCP endpoint is:

```text
http://localhost:8000/mcp
```

For ChatGPT developer testing, expose the local MCP endpoint with a secure tunnel such as ngrok, then add the public `/mcp` URL in ChatGPT developer mode.

## Usage

In ChatGPT, ask ProposalCraft AI to generate a proposal and provide:

- Business name, optional
- Contact name, phone, email, website, license/insurance note, prepared date, and proposal ID, optional
- Client name, optional
- Project description
- Service type
- Price
- Optional pricing breakdown lines such as labor, materials, disposal, travel, or add-ons
- Deposit percentage, optional
- Timeline
- Tone

Example:

```text
Generate a friendly paving proposal for a backyard patio installation.
The job is a 300 sq ft patio with compacted base, border edging, and cleanup.
Prepared by Greenline Outdoor Works for Jordan Smith.
Price is 4250 with a 30% deposit. Timeline is 4-5 working days.
Pricing breakdown: Labor 2400, materials 1650, disposal and cleanup 200.
```

The tool returns structured content for the widget, a copy-ready formatted proposal in Markdown, a plain-text proposal, optional pricing line items, Good / Better / Best option tiers, next-step copy, a short client email, an approval message, approval/signature copy, and a follow-up email draft.

## Tools

### `generateProposal`

Creates a proposal from the required job fields.

### `generateProposalPdf`

Creates the same proposal and returns a client-ready PDF attachment.

### `regenerateProposal`

Creates the same deterministic proposal shape again, optionally with a tracked revision note.

### `explainProposal`

Explains which service template and deterministic rules were used.

## Project Structure

```text
api/
  mcp.ts                    Vercel API entrypoint
src/
  core/
    proposal.ts             Proposal generation logic
    types.ts                Shared types
    validation.ts           Zod validation
  server/
    http.ts                 MCP HTTP/SSE transport
    mcp.ts                  Tool and resource registration
    widget.ts               Widget HTML loading
  templates/
    proposal-templates.json Service templates
  widget/
    main.tsx                React app
    proposalcraft.html      Widget HTML
    styles.css              Widget styles
tests/
  proposal.test.ts          Core behavior tests
```

## Extending Templates

Edit `src/templates/proposal-templates.json` and add a new service entry with:

- `label`
- `overviewLead`
- `scopeItems`
- `paymentTerms`
- `assumptions`
- `upsells`

Then add the new service key to `serviceTypes` in `src/core/types.ts`. The generator and UI will use that key once it is included in the type list and label map.

## Deployment

1. Push the repo to GitHub.
2. Import it into Vercel.
3. Set `BASE_URL` to your deployed origin, for example `https://proposalcraft-ai.vercel.app`.
4. Deploy.
5. Add `https://your-domain.vercel.app/mcp` as the MCP endpoint in ChatGPT developer mode.

Vercel uses `vercel.json` to route `/mcp` and `/mcp/messages` to the API handler.

## Quality Checks

```bash
npm run check
npm test
npm run build
```

## Notes

ProposalCraft AI does not estimate pricing. It formats the price supplied by the user and keeps assumptions explicit so service providers can review the proposal before sending it to a client.
