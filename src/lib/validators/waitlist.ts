import { z } from "zod";
import { isPlanId } from "@/lib/razorpay";

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  // Loosely validated — this is informational metadata about the signup,
  // not something access control depends on, so an unrecognized value is
  // dropped rather than rejecting the whole submission.
  planId: z
    .string()
    .optional()
    .transform((v) => (v && isPlanId(v) ? v : undefined)),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .max(10)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
