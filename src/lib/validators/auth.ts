import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72).refine(value => new TextEncoder().encode(value).length <= 72, "Password must fit within 72 UTF-8 bytes; use fewer characters."),
});

export type SignupInput = z.infer<typeof signupSchema>;
