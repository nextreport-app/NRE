import { z } from "zod";
import { whatsappDigitsOnly } from "@/lib/whatsapp-number";

export const whatsappNumberSchema = z
  .string()
  .trim()
  .min(1, "Enter your WhatsApp number")
  .refine((val) => {
    const digits = whatsappDigitsOnly(val);
    return digits.length >= 10 && digits.length <= 15;
  }, "Enter a valid WhatsApp number (include country code if outside India)");
