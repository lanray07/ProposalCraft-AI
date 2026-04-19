import { generateProposal } from "./proposal.js";
import type { Proposal, ProposalInput, ProposalSection } from "./types.js";

export type ProposalPdfFile = {
  proposal: Proposal;
  filename: string;
  mimeType: "application/pdf";
  base64: string;
  byteLength: number;
};

type PdfColor = "dark" | "muted" | "accent" | "white";

type PdfLine = {
  text: string;
  font: "regular" | "bold";
  size: number;
  color?: PdfColor;
  gapBefore?: number;
  indent?: number;
};

const pageWidth = 612;
const pageHeight = 792;
const marginX = 54;
const firstPageStartY = 575;
const pageStartY = 720;
const footerY = 34;
const bodySize = 10;
const headingSize = 12;
const maxBodyCharacters = 86;
const maxHeadingCharacters = 58;
const maxTitleCharacters = 32;

export function generateProposalPdf(input: ProposalInput): ProposalPdfFile {
  const proposal = generateProposal(input);
  const bytes = createPdfBytes(proposal);

  return {
    proposal,
    filename: `${slugify(proposal.title)}.pdf`,
    mimeType: "application/pdf",
    base64: bytesToBase64(bytes),
    byteLength: bytes.length
  };
}

function createPdfBytes(proposal: Proposal): Uint8Array {
  const pages = paginateLines(createPdfLines(proposal));
  const fontObjectNumber = 3 + pages.length * 2;
  const boldFontObjectNumber = fontObjectNumber + 1;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages
      .map((_, index) => `${3 + index * 2} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`
  ];

  for (const [index, pageLines] of pages.entries()) {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = createContentStream(pageLines, index + 1, pages.length, proposal);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectNumber} 0 R /F2 ${boldFontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${asciiByteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  return buildPdf(objects);
}

function createPdfLines(proposal: Proposal): PdfLine[] {
  const lines: PdfLine[] = [
    {
      text: "Proposal Details",
      font: "bold",
      size: headingSize,
      color: "accent",
      gapBefore: 0
    },
    ...detailsToPdfLines(proposal),
    ...sectionToPdfLines({
      title: "Project Overview",
      body: proposal.projectOverview
    }),
    ...sectionToPdfLines({
      title: "Scope of Work",
      body: proposal.scopeOfWork
    }),
    ...sectionToPdfLines({
      title: "Timeline",
      body: proposal.timeline
    }),
    ...sectionToPdfLines({
      title: "Pricing Summary",
      body: [
        proposal.pricingSummary,
        ...proposal.pricingBreakdown.map(
          (line) => `${line.label}: ${formatCurrency(line.amount)}`
        ),
        ...(proposal.depositSummary ? [proposal.depositSummary] : [])
      ]
    }),
    ...sectionToPdfLines({
      title: "Proposal Options",
      body: proposal.proposalOptions.map(
        (option) =>
          `${option.name} - ${formatCurrency(option.price)}: ${option.summary} Includes ${option.includes.join("; ")}.`
      )
    }),
    ...sectionToPdfLines({
      title: "Payment Terms",
      body: proposal.paymentTerms
    }),
    ...sectionToPdfLines({
      title: "Assumptions",
      body: proposal.assumptions
    }),
    ...sectionToPdfLines({
      title: "Optional Upsells",
      body: proposal.optionalUpsells
    }),
    ...sectionToPdfLines({
      title: "Next Steps",
      body: proposal.nextSteps
    }),
    ...sectionToPdfLines({
      title: "Approval",
      body: proposal.approvalText
    })
  ];

  return lines;
}

function detailsToPdfLines(proposal: Proposal): PdfLine[] {
  const details = proposal.details;
  const values = [
    details.preparedBy ? `Prepared by: ${details.preparedBy}` : undefined,
    details.preparedFor ? `Prepared for: ${details.preparedFor}` : undefined,
    details.contactName ? `Contact: ${details.contactName}` : undefined,
    details.phone ? `Phone: ${details.phone}` : undefined,
    details.email ? `Email: ${details.email}` : undefined,
    details.website ? `Website: ${details.website}` : undefined,
    details.licenseNote ? `License/insurance: ${details.licenseNote}` : undefined,
    `Prepared date: ${details.preparedDate}`,
    `Proposal ID: ${details.proposalId}`
  ].filter(Boolean) as string[];

  return values.flatMap((value) =>
    wrapPdfLine(value, {
      font: "regular",
      size: bodySize,
      color: "dark",
      maxCharacters: maxBodyCharacters
    })
  );
}

function sectionToPdfLines(section: ProposalSection): PdfLine[] {
  const lines = wrapPdfLine(section.title, {
    font: "bold",
    size: headingSize,
    color: "accent",
    maxCharacters: maxHeadingCharacters,
    gapBefore: 16
  });
  const items = Array.isArray(section.body) ? section.body : [section.body];

  for (const item of items) {
    const prefix = Array.isArray(section.body) ? "- " : "";
    lines.push(
      ...wrapPdfLine(`${prefix}${item}`, {
        font: "regular",
        size: bodySize,
        color: "dark",
        indent: Array.isArray(section.body) ? 10 : 0,
        maxCharacters: maxBodyCharacters - (Array.isArray(section.body) ? 6 : 0)
      })
    );
  }

  return lines;
}

function wrapPdfLine(
  input: string,
  options: {
    font: PdfLine["font"];
    size: number;
    color?: PdfColor;
    maxCharacters: number;
    gapBefore?: number;
    indent?: number;
  }
): PdfLine[] {
  const source = sanitizePdfText(input);

  if (source.trim() === "") {
    return [
      {
        text: "",
        font: options.font,
        size: options.size,
        color: options.color,
        gapBefore: options.gapBefore,
        indent: options.indent
      }
    ];
  }

  const words = source.split(/\s+/);
  const lines: PdfLine[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= options.maxCharacters) {
      current = next;
    } else {
      if (current) {
        lines.push({
          text: current,
          font: options.font,
          size: options.size,
          color: options.color,
          gapBefore: lines.length === 0 ? options.gapBefore : undefined,
          indent: options.indent
        });
      }
      current = word;
    }
  }

  if (current) {
    lines.push({
      text: current,
      font: options.font,
      size: options.size,
      color: options.color,
      gapBefore: lines.length === 0 ? options.gapBefore : undefined,
      indent: options.indent
    });
  }

  return lines;
}

function paginateLines(lines: PdfLine[]): PdfLine[][] {
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let y = firstPageStartY;

  for (const line of lines) {
    const gap = line.gapBefore ?? 4;
    const height = line.size + gap + 4;

    if (page.length > 0 && y - height < footerY + 30) {
      pages.push(page);
      page = [];
      y = pageStartY;
    }

    page.push(line);
    y -= height;
  }

  if (page.length > 0) {
    pages.push(page);
  }

  return pages.length ? pages : [[{ text: "", font: "regular", size: bodySize }]];
}

function createContentStream(
  lines: PdfLine[],
  pageNumber: number,
  pageCount: number,
  proposal: Proposal
): string {
  const commands: string[] = [
    "1 1 1 rg",
    `0 0 ${pageWidth} ${pageHeight} re f`
  ];

  if (pageNumber === 1) {
    commands.push(...createCoverHeaderCommands(proposal));
  }

  commands.push(
    "0.85 0.88 0.84 RG",
    `54 ${footerY + 18} m 558 ${footerY + 18} l S`,
    "BT"
  );

  let y = pageNumber === 1 ? firstPageStartY : pageStartY;

  for (const line of lines) {
    y -= line.gapBefore ?? 4;
    commands.push(
      colorCommand(line.color ?? "dark"),
      `/${line.font === "bold" ? "F2" : "F1"} ${line.size} Tf`,
      `${marginX + (line.indent ?? 0)} ${y} Td`,
      `(${escapePdfText(line.text)}) Tj`,
      `${-(marginX + (line.indent ?? 0))} ${-y} Td`
    );
    y -= line.size + 4;
  }

  commands.push(
    colorCommand("muted"),
    "/F1 8 Tf",
    `54 ${footerY} Td`,
    `(${escapePdfText(`${proposal.details.proposalId} | Page ${pageNumber} of ${pageCount}`)}) Tj`,
    "ET"
  );

  return commands.join("\n");
}

function createCoverHeaderCommands(proposal: Proposal): string[] {
  const details = proposal.details;
  const total = proposal.proposalOptions[0]?.price ?? 0;
  const preparedFor = details.preparedFor ?? "Client";
  const preparedBy = details.preparedBy ?? proposal.businessName ?? "ProposalCraft AI";
  const contactLine = [
    details.contactName,
    details.phone,
    details.email
  ].filter(Boolean).join(" | ");

  return [
    "0.10 0.42 0.34 rg",
    "0 632 612 160 re f",
    "0.83 0.91 0.86 rg",
    "54 628 504 4 re f",
    "BT",
    colorCommand("white"),
    "/F2 25 Tf",
    "54 727 Td",
    `(${escapePdfText(trimForPdf(proposal.title, maxTitleCharacters))}) Tj`,
    "-54 -727 Td",
    "/F1 10 Tf",
    "54 704 Td",
    `(${escapePdfText(`${preparedBy} | Prepared for ${preparedFor}`)}) Tj`,
    "-54 -704 Td",
    "/F1 9 Tf",
    "54 686 Td",
    `(${escapePdfText(contactLine || `Prepared ${details.preparedDate}`)}) Tj`,
    "-54 -686 Td",
    "/F2 9 Tf",
    "54 655 Td",
    `(TOTAL) Tj`,
    "-54 -655 Td",
    "/F1 12 Tf",
    "54 638 Td",
    `(${escapePdfText(formatCurrency(total))}) Tj`,
    "-54 -638 Td",
    "/F2 9 Tf",
    "192 655 Td",
    `(TIMELINE) Tj`,
    "-192 -655 Td",
    "/F1 12 Tf",
    "192 638 Td",
    `(${escapePdfText(trimForPdf(proposal.timeline, 26))}) Tj`,
    "-192 -638 Td",
    "/F2 9 Tf",
    "388 655 Td",
    `(PROPOSAL ID) Tj`,
    "-388 -655 Td",
    "/F1 12 Tf",
    "388 638 Td",
    `(${escapePdfText(trimForPdf(details.proposalId, 23))}) Tj`,
    "-388 -638 Td",
    "ET",
    "0.93 0.95 0.92 RG",
    "54 604 m 558 604 l S"
  ];
}

function colorCommand(color: PdfColor): string {
  if (color === "accent") {
    return "0.10 0.42 0.34 rg";
  }

  if (color === "muted") {
    return "0.38 0.43 0.40 rg";
  }

  if (color === "white") {
    return "1 1 1 rg";
  }

  return "0.09 0.10 0.09 rg";
}

function buildPdf(objects: string[]): Uint8Array {
  const chunks = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let offset = asciiByteLength(chunks[0]);

  objects.forEach((object, index) => {
    offsets.push(offset);
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    offset += asciiByteLength(chunk);
  });

  const xrefOffset = offset;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");

  chunks.push(xref);
  return asciiToBytes(chunks.join(""));
}

function sanitizePdfText(value: string): string {
  return value
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function trimForPdf(value: string, maxCharacters: number): string {
  const clean = sanitizePdfText(value);

  if (clean.length <= maxCharacters) {
    return clean;
  }

  return `${clean.slice(0, Math.max(0, maxCharacters - 3)).trim()}...`;
}

function asciiByteLength(value: string): number {
  return asciiToBytes(value).length;
}

function asciiToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    output += alphabet[(combined >> 18) & 63];
    output += alphabet[(combined >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(combined >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[combined & 63] : "=";
  }

  return output;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "proposal";
}
