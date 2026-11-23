import { ServiceError } from "./service-error";

type Ga4Stage = "authorization" | "properties" | "property" | "report";

/** Safe provider diagnostics: never expose Google's raw body, URLs or credentials. */
export async function ga4RequestError(response: Response, stage: Ga4Stage): Promise<ServiceError> {
  const body = await response.json().catch(() => null) as {
    error?: string | { details?: Array<{ reason?: string }> };
  } | null;
  const oauthCode = typeof body?.error === "string" ? body.error : null;
  const reasons = typeof body?.error === "object" && body.error !== null && Array.isArray(body.error.details)
    ? body.error.details.map((detail) => detail?.reason) : [];
  const status = response.status;
  let code = "REQUEST_FAILED", message: string;
  if (reasons.includes("SERVICE_DISABLED")) {
    code = "API_DISABLED";
    message = `The Google Analytics ${stage === "report" ? "Data" : "Admin"} API is disabled for NextReport’s Google Cloud project. NextReport support must enable it; reconnecting your account alone will not fix this.`;
  } else if (oauthCode === "invalid_client" || oauthCode === "unauthorized_client") {
    code = "OAUTH_CONFIGURATION";
    message = "NextReport’s GA4 connection configuration needs attention. Contact support; changing the linked property will not fix it.";
  } else if (oauthCode === "invalid_grant" || status === 401) {
    code = "RECONNECT";
    message = "Google Analytics authorization expired or was revoked. Reconnect Google Analytics in Account settings, then refresh again.";
  } else if (status === 429 || reasons.includes("RATE_LIMIT_EXCEEDED") || reasons.includes("QUOTA_EXCEEDED")) {
    code = "QUOTA";
    message = "Google Analytics temporarily limited requests. Wait a few minutes and retry; your saved figures have not been refreshed.";
  } else if (status === 403) {
    code = "ACCESS_DENIED";
    message = "Google denied Analytics access. Confirm the connected Google account has Viewer access to the linked GA4 property and granted Analytics read access. If those are correct, contact support to check the app’s Google API setup.";
  } else if (status === 404) {
    code = "PROPERTY_UNAVAILABLE";
    message = "The linked GA4 property could not be accessed. Choose a property available to the connected Google account.";
  } else if (status === 400 && stage === "report") {
    code = "QUERY_REJECTED";
    message = "Google Analytics rejected NextReport’s dashboard query. Contact support with this error code; reconnecting alone will not correct the query.";
  } else if (status >= 500) {
    code = "PROVIDER_UNAVAILABLE";
    message = "Google Analytics is temporarily unavailable. Retry shortly; prior figures are not a fresh check.";
  } else {
    message = "The Google Analytics request failed. Contact support with this error code; prior figures are not a fresh check.";
  }
  const reference = `GA4_${stage.toUpperCase()}_${code}_${status}`;
  console.warn("[ga4:request-failed]", { stage, code, status });
  return new ServiceError(`${message} (${reference})`, 502);
}
