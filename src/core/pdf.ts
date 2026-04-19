import { generateProposal } from "./proposal.js";
import type { Proposal, ProposalInput } from "./types.js";

export type ProposalPdfFile = {
  proposal: Proposal;
  filename: string;
  mimeType: "application/pdf";
  base64: string;
  byteLength: number;
};

const pageWidth = 612;
const pageHeight = 792;
const marginX = 54;
const startY = 738;
const fontSize = 10;
const lineHeight = 14;
const maxCharactersPerLine = 92;
const maxLinesPerPage = 48;

export function generateProposalPdf(input: ProposalInput): ProposalPdfFile {
  const proposal = generateProposal(input);
  const bytes = createPdfBytes(proposal.plainTextProposal);

  return {
    proposal,
    filename: `${slugify(proposal.title)}.pdf`,
    mimeType: "application/pdf",
    base64: bytesToBase64(bytes),
    byteLength: bytes.length
  };
}

function createPdfBytes(text: string): Uint8Array {
  const pages = paginate(wrapText(text));
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages
      .map((_, index) => `${3 + index * 2} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`
  ];

  for (const [index, pageLines] of pages.entries()) {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = createContentStream(pageLines);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${asciiByteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

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

function createContentStream(lines: string[]): string {
  const content = lines
    .map((line) => `(${escapePdfText(line)}) Tj T*`)
    .join("\n");

  return `BT /F1 ${fontSize} Tf ${lineHeight} TL ${marginX} ${startY} Td\n${content}\nET`;
}

function wrapText(text: string): string[] {
  return text.split(/\r?\n/).flatMap((line) => {
    if (line.trim() === "") {
      return [""];
    }

    const words = line.split(/\s+/);
    const wrapped: string[] = [];
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;

      if (next.length <= maxCharactersPerLine) {
        current = next;
      } else {
        if (current) {
          wrapped.push(current);
        }
        current = word;
      }
    }

    if (current) {
      wrapped.push(current);
    }

    return wrapped;
  });
}

function paginate(lines: string[]): string[][] {
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }

  return pages.length ? pages : [[""]];
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
