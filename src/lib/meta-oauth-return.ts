export const META_OAUTH_RETURN_COOKIE = "meta_ads_return_to";
/** Only return to a client wizard; never accept external or arbitrary internal redirects. */
export function safeMetaOAuthReturnTo(value: string | null | undefined): string | null {
  return value && /^\/clients\/[A-Za-z0-9_-]+\/reports\/new$/.test(value) ? value : null;
}
