import { z } from "zod";

export const SUPPORT_TICKET_CATEGORIES = [
  "Wrong metrics or numbers",
  "Wrong objective detected",
  "AI insights incorrect",
  "Report generation error",
  "CSV upload or validation issue",
  "Feature question",
  "Other",
] as const;

export const supportTicketFieldsSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  category: z.enum(SUPPORT_TICKET_CATEGORIES, { message: "Choose an issue type" }),
  message: z.string().trim().min(10, "Describe the issue in at least 10 characters"),
  clientId: z.string().trim().optional(),
  reportId: z.string().trim().optional(),
});

export type SupportTicketFields = z.infer<typeof supportTicketFieldsSchema>;
