/**
 * Google Ads campaign-type classifier — delegates to google-objective-dictionary.ts.
 * Re-exported here for backward compatibility with existing imports.
 */

export type { GoogleObjectiveKey } from "./google-objective-dictionary";
export {
  detectGoogleObjectiveFromHeaders,
  detectGoogleObjectiveKey,
  googleObjectiveSpecForKey,
  GOOGLE_OBJECTIVE_SPECS,
} from "./google-objective-dictionary";
