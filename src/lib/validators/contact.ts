import { z } from "zod";

export const CONTACT_SUBJECTS = [
  "General Enquiry",
  "Technical Support",
  "Billing Question",
  "Feature Request",
  "Report an Issue",
  "Partnership",
  "Other",
] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  subject: z.enum(CONTACT_SUBJECTS, { message: "Choose a subject" }),
  message: z.string().trim().min(10, "Message must be at least 10 characters"),
});

export type ContactInput = z.infer<typeof contactSchema>;
