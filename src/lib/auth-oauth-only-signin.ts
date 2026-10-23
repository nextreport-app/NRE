import { CredentialsSignin } from "@auth/core/errors";

/** Thrown when a Google-only account tries email/password before setting a password. */
export class OAuthOnlyAccountSignin extends CredentialsSignin {
  code = "oauth_only";
}
