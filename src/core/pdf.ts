import { generateProposal } from "./proposal.js";
import type { Proposal, ProposalInput, ProposalSection } from "./types.js";

export type ProposalPdfFile = {
  proposal: Proposal;
  filename: string;
  mimeType: "application/pdf";
  base64: string;
  byteLength: number;
};

type PdfLine = {
  text: string;
  font: "regular" | "bold";
  size: number;
  gapBefore?: number;
};

const pageWidth = 612;
const pageHeight = 792;
const marginX = 54;
const startY = 720;
const footerY = 34;
const bodySize = 10;
const headingSize = 14;
const titleSize = 22;
const bodyLineHeight = 14;
const maxBodyCharacters = 88;
const maxHeadingCharacters = 58;
const maxTitleCharacters = 36;

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
    ...wrapPdfLine(proposal.title, {
      font: "bold",
      size: titleSize,
      maxCharacters: maxTitleCharacters
    }),
    {
      text: proposal.details.preparedBy ?? "Client-ready service proposal",
      font: "regular",
      size: 11
    }
  ];

  for (const section of proposal.sections) {
    lines.push(...sectionToPdfLines(section));
  }

  return lines;
}

function sectionToPdfLines(section: ProposalSection): PdfLine[] {
  const lines = wrapPdfLine(section.title, {
    font: "bold",
    size: headingSize,
    maxCharacters: maxHeadingCharacters,
    gapBefore: 14
  });
  const items = Array.isArray(section.body) ? section.body : [section.body];

  for (const item of items) {
    const prefix = Array.isArray(section.body) ? "- " : "";
    lines.push(
      ...wrapPdfLine(`${prefix}${item}`, {
        font: "regular",
        size: bodySize,
        maxCharacters: maxBodyCharacters
      })
    );
  }

  return lines;
}

function wrapPdfLine(input: string, options: {
  font: PdfLine["font"];
  size: number;
  maxCharacters: number;
  gapBefore?: number;
}): PdfLine[] {
  const source = sanitizePdfText(input);

  if (source.trim() === "") {
    return [{ text: "", font: options.font, size: options.size, gapBefore: options.gapBefore }];
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
          gapBefore: lines.length === 0 ? options.gapBefore : undefined
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
      gapBefore: lines.length === 0 ? options.gapBefore : undefined
    });
  }

  return lines;
}

function paginateLines(lines: PdfLine[]): PdfLine[][] {
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let y = startY;

  for (const line of lines) {
    const gap = line.gapBefore ?? 3;
    const height = line.size + gap + 4;

    if (page.length > 0 && y - height < footerY + 28) {
      pages.push(page);
      page = [];
      y = startY;
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
    "0.96 0.97 0.94 rg",
    `0 0 ${pageWidth} ${pageHeight} re f`,
    "0.12 0.18 0.15 rg",
    "BT"
  ];
  let y = startY;

  for (const line of lines) {
    y -= line.gapBefore ?? 3;
    commands.push(
      `/${line.font === "bold" ? "F2" : "F1"} ${line.size} Tf`,
      `${marginX} ${y} Td`,
      `(${escapePdfText(line.text)}) Tj`,
      `${-marginX} ${-y} Td`
    );
    y -= line.size + 4;
  }

  commands.push(
    "/F1 8 Tf",
    `54 ${footerY} Td`,
    `(${escapePdfText(`${proposal.details.proposalId} | Page ${pageNumber} of ${pageCount}`)}) Tj`,
    "ET"
  );

  return commands.join("\n");
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
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
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

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "proposal";
}
