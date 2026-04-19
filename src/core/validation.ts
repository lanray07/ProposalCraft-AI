import { z } from "zod";
import { serviceTypes, tones } from "./types.js";

export const proposalInputSchema = z.object({
  businessName: z
    .string()
    .trim()
    .max(120, "Business name must be 120 characters or fewer.")
    .optional()
    .transform((value) => value || undefined),
  clientName: z
    .string()
    .trim()
    .max(120, "Client name must be 120 characters or fewer.")
    .optional()
    .transform((value) => value || undefined),
  projectDescription: z
    .string()
    .trim()
    .min(12, "Project description must be at least 12 characters.")
    .max(2500, "Project description must be 2,500 characters or fewer."),
  serviceType: z.enum(serviceTypes),
  price: z.coerce
    .number()
    .finite("Price must be a valid number.")
    .nonnegative("Price cannot be negative.")
    .max(10000000, "Price is outside the supported range."),
  pricingBreakdown: z
    .array(
      z.object({
        label: z
          .string()
          .trim()
          .min(1, "Pricing breakdown labels are required.")
          .max(80, "Pricing breakdown labels must be 80 characters or fewer."),
        amount: z.coerce
          .number()
          .finite("Pricing breakdown amounts must be valid numbers.")
          .nonnegative("Pricing breakdown amounts cannot be negative.")
          .max(10000000, "Pricing breakdown amounts are outside the supported range.")
      })
    )
    .max(12, "Pricing breakdown can include up to 12 line items.")
    .optional()
    .transform((value) => value?.filter((item) => item.label) ?? undefined),
  depositPercent: z.coerce
    .number()
    .finite("Deposit percent must be a valid number.")
    .min(0, "Deposit percent cannot be negative.")
    .max(100, "Deposit percent cannot exceed 100.")
    .optional(),
  timeline: z
    .string()
    .trim()
    .min(2, "Timeline is required.")
    .max(250, "Timeline must be 250 characters or fewer."),
  tone: z.enum(tones)
});

export const regenerateProposalInputSchema = proposalInputSchema.extend({
  revisionNote: z.string().trim().max(500).optional()
});

export const explainProposalInputSchema = z.object({
  serviceType: z.enum(serviceTypes),
  tone: z.enum(tones).optional()
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(" ");
}
