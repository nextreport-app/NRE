#!/usr/bin/env node
/**
 * Meta Marketing API tier qualification runner.
 *
 * Meta requires 500+ Marketing API calls in the last 15 days with an error
 * rate below 15% on the rolling last-500 window before approving Full access
 * to Marketing API Access Tier.
 *
 * Usage:
 *   META_TOKEN=<user-access-token> node scripts/meta-tier-qualification.js
 *
 * Optional:
 *   META_AD_ACCOUNT_ID=908256752348097   # numeric id only (no act_ prefix)
 *   META_API_VERSION=v26.0
 *   META_CALL_COUNT=500
 *   META_DELAY_MS=2500                   # default 2.5s — slow avoids rate limits
 *   META_LIGHT_MODE=1                    # default on: only /me/adaccounts (safest)
 *
 * Get a token from Graph API Explorer (select your app, ads_read scope) or
 * connect Meta Ads in NextReport Account settings after deploying META_APP_*.
 */

const TOKEN = process.env.META_TOKEN?.trim();
const API_VERSION = process.env.META_API_VERSION?.trim() || "v26.0";
const CALL_COUNT = Math.max(1, Number(process.env.META_CALL_COUNT) || 500);
const DELAY_MS = Math.max(500, Number(process.env.META_DELAY_MS) || 2500);
const LIGHT_MODE = process.env.META_LIGHT_MODE !== "0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;

/** Meta rate-limit / throttle error codes — retry with backoff, don't rush. */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80003, 80004, 80014]);

async function graphGet(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", TOKEN);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error.message);
    err.code = data.error.code;
    err.type = data.error.type;
    throw err;
  }
  return data;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function preflight(accountId) {
  console.log(`\nPreflight checks (API ${API_VERSION})…`);
  if (LIGHT_MODE) {
    console.log("Mode: LIGHT — only /me/adaccounts calls (best for dev-tier rate limits)");
  }

  const me = await graphGet("/me", { fields: "id,name" });
  console.log(`✓ Token valid for Meta user: ${me.name ?? me.id} (${me.id})`);

  const accounts = await graphGet("/me/adaccounts", {
    fields: "id,name,account_id,account_status",
    limit: 25,
  });
  const list = accounts.data ?? [];
  if (list.length === 0) {
    throw new Error("No ad accounts returned for this token. Ensure ads_read is granted.");
  }
  console.log(`✓ Found ${list.length} ad account(s)`);

  if (LIGHT_MODE) {
    return accountId;
  }

  let resolvedId = accountId;
  if (!resolvedId) {
    const first = list[0];
    resolvedId = first.account_id ?? first.id.replace(/^act_/, "");
    console.log(`→ Using first ad account: ${first.name} (act_${resolvedId})`);
  } else {
    const match = list.find(
      (a) => a.account_id === resolvedId || a.id === `act_${resolvedId}` || a.id === resolvedId,
    );
    if (!match) {
      console.warn(
        `⚠ act_${resolvedId} not in token's account list — calls may fail. Available:`,
        list.map((a) => a.account_id ?? a.id).join(", "),
      );
    } else {
      console.log(`✓ Ad account act_${resolvedId} accessible (${match.name})`);
    }
  }

  await graphGet(`/act_${resolvedId}/campaigns`, { fields: "id,name", limit: 3 });
  console.log("✓ Campaigns endpoint OK");

  return resolvedId;
}

function buildCallPlan(accountId) {
  if (LIGHT_MODE) {
    // Single lightweight endpoint — counts as Marketing API read, minimal throttle risk.
    return [`${BASE}/me/adaccounts?fields=id,name,account_status&limit=5`];
  }

  const act = `act_${accountId}`;
  return [
    `/me/adaccounts?fields=id,name&limit=5`,
    `${act}/campaigns?fields=id,name,status&limit=5`,
    `${act}/adsets?fields=id,name,status&limit=5`,
    `${act}?fields=id,name,account_status,currency`,
  ].map((suffix) => `${BASE}${suffix.startsWith("/") ? suffix : `/${suffix}`}`);
}

async function makeCall(url) {
  try {
    const res = await fetch(`${url}&access_token=${TOKEN}`);
    const data = await res.json();
    if (data.error) {
      return { ok: false, message: data.error.message, code: data.error.code };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function isRateLimitError(code) {
  return code != null && RATE_LIMIT_CODES.has(Number(code));
}

async function makeCallWithRetry(url, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await makeCall(url);
    if (result.ok) return result;

    if (isRateLimitError(result.code) && attempt < maxRetries) {
      const waitSec = 30 * (attempt + 1);
      console.log(
        `  Rate limited (${result.code}) — waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}…`,
      );
      await sleep(waitSec * 1000);
      continue;
    }

    return result;
  }
  return { ok: false, message: "Rate limit retries exhausted" };
}

async function run() {
  if (!TOKEN) {
    console.error("ERROR: Set META_TOKEN to a user access token with ads_read scope.");
    console.error("Generate one in Graph API Explorer for YOUR Meta app.");
    process.exit(1);
  }

  let accountId = process.env.META_AD_ACCOUNT_ID?.replace(/^act_/, "") || null;

  try {
    accountId = await preflight(accountId);
  } catch (err) {
    console.error("\nPreflight FAILED:", err.message);
    if (err.code) console.error(`  code: ${err.code}, type: ${err.type}`);
    console.error("\nFix token, permissions, or ad account before running 500 calls.");
    process.exit(1);
  }

  const calls = buildCallPlan(accountId);
  let success = 0;
  let errors = 0;
  let consecutiveHardErrors = 0;
  const estMinutes = Math.ceil((CALL_COUNT * DELAY_MS) / 60000);

  console.log(`\nStarting ${CALL_COUNT} Marketing API calls (${DELAY_MS}ms delay, ~${estMinutes} min)…`);
  console.log("Rate-limit errors auto-retry with backoff. Hard errors abort after 5 in a row.\n");

  for (let i = 0; i < CALL_COUNT; i++) {
    const url = calls[i % calls.length];
    const result = await makeCallWithRetry(url);

    if (result.ok) {
      success++;
      consecutiveHardErrors = 0;
    } else {
      errors++;
      consecutiveHardErrors++;
      console.log(`ERROR [${i + 1}]: ${result.message}${result.code ? ` (${result.code})` : ""}`);

      if (consecutiveHardErrors >= 5) {
        console.error("\nAborting — 5 consecutive hard errors.");
        console.error("If you hit rate limits, wait 1–2 hours and run again with:");
        console.error("  set META_DELAY_MS=4000");
        console.error("  set META_CALL_COUNT=200");
        break;
      }
    }

    if ((i + 1) % 25 === 0) {
      const rate = ((success / (i + 1)) * 100).toFixed(1);
      console.log(`Progress: ${i + 1}/${CALL_COUNT} — Success: ${success}, Errors: ${errors} (${rate}% success)`);
    }

    await sleep(DELAY_MS);
  }

  const total = success + errors;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : "0.0";

  console.log(`\nDone! Completed: ${total}, Success: ${success}, Errors: ${errors}`);
  console.log(`Success rate this run: ${successRate}%`);
  console.log("\nNext steps:");
  console.log("1. If rate limited, wait 1–2 hours before another batch");
  console.log("2. Check App Dashboard → App Review → Marketing API Access Tier metrics");
  console.log("3. Wait until last-500 error rate is below 15%, then resubmit App Review");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
