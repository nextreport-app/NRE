import { z } from "zod";
import { optionalWhatsappNumberSchema } from "@/lib/validators/whatsapp-number";

export const BOOK_DEMO_TEAM_SIZES = [
  "Just me",
  "2–5 people",
  "6–15 people",
  "16+ people",
] as const;

export const bookDemoSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  whatsapp: optionalWhatsappNumberSchema,
  company: z.string().trim().min(1, "Enter your agency or company name"),
  teamSize: z.enum(BOOK_DEMO_TEAM_SIZES, { message: "Choose a team size" }),
  message: z.string().trim().min(1, "Enter a message"),
});

export type BookDemoInput = z.infer<typeof bookDemoSchema>;
