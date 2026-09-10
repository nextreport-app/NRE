import { z } from "zod";
import {
  hasExplicitCountryPrefix,
  isUkLocalMobileDigits,
  whatsappDigitsOnly,
} from "@/lib/whatsapp-number";

const COUNTRY_CODE_HINT =
  "Include country code — e.g. +1 (US), +44 (UK), +91 (India), or 07… for UK mobiles";

function isValidWhatsAppInput(val: string): boolean {
  const trimmed = val.trim();
  const digits = whatsappDigitsOnly(trimmed);

  if (digits.length < 10 || digits.length > 15) return false;

  // Explicit + or 00 international prefix — any country.
  if (hasExplicitCountryPrefix(trimmed)) return true;

  // UK local mobile: 07123 456789
  if (isUkLocalMobileDigits(digits)) return true;

  // Full number pasted without + (e.g. 15551234567, 447700900123, 919876543210).
  if (digits.length >= 11) return true;

  // Bare 10-digit numbers are ambiguous across US/UK/India — require a country code.
  return false;
}

export const whatsappNumberSchema = z
  .string()
  .trim()
  .min(1, "Enter your WhatsApp number")
  .refine(isValidWhatsAppInput, COUNTRY_CODE_HINT);
