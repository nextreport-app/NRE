import { z } from "zod";
import { optionalWhatsappNumberSchema } from "@/lib/validators/whatsapp-number";

export const CONTACT_SUBJECTS = [
  "General Enquiry",
  "Product Feedback",
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
  whatsapp: optionalWhatsappNumberSchema,
  subject: z.enum(CONTACT_SUBJECTS, { message: "Choose a subject" }),
  message: z.string().trim().min(1, "Enter a message"),
});

export type ContactInput = z.infer<typeof contactSchema>;
