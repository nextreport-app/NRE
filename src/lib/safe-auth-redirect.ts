/** Next router must never receive javascript:, protocol-relative or cross-origin login callbacks. */
export function safeAuthRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u0020]/.test(value)) return "/clients";
  return value;
}
