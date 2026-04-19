/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { generateProposalPdf } from "../src/core/pdf.js";

const baseInput = {
  businessName: "ClearFlow Plumbing",
  contactName: "Jordan Smith",
  businessPhone: "(555) 014-2400",
  businessEmail: "hello@clearflow.example",
  clientName: "Morgan Lee",
  projectDescription:
    "replace leaking bathroom faucet, inspect shutoff valves, test for leaks, and clean the work area",
  serviceType: "hvac" as const,
  price: 385,
  pricingBreakdown: [
    { label: "Labor", amount: 250 },
    { label: "Materials", amount: 110 },
    { label: "Cleanup", amount: 25 }
  ],
  depositPercent: 20,
  timeline: "same-day 2-hour service",
  tone: "friendly" as const
};

describe("proposal PDF generation", () => {
  it("creates a real PDF attachment from proposal content", () => {
    const pdf = generateProposalPdf(baseInput);
    const bytes = Buffer.from(pdf.base64, "base64");
    const text = bytes.toString("latin1");

    expect(pdf.filename).toBe("hvac-proposal-for-morgan-lee.pdf");
    expect(pdf.mimeType).toBe("application/pdf");
    expect(pdf.byteLength).toBeGreaterThan(1000);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("HVAC Proposal for Morgan Lee");
    expect(text).toContain("Labor: $250");
  });
});
