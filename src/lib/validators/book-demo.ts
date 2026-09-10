import { z } from "zod";

export const BOOK_DEMO_TEAM_SIZES = [
  "Just me",
  "2–5 people",
  "6–15 people",
  "16+ people",
] as const;

export const bookDemoSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  company: z.string().trim().min(1, "Enter your agency or company name"),
  teamSize: z.enum(BOOK_DEMO_TEAM_SIZES, { message: "Choose a team size" }),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a bit about what you want to see (at least 10 characters)"),
});

export type BookDemoInput = z.infer<typeof bookDemoSchema>;
