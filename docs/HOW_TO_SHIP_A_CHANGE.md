# How this change becomes live

The prepared branch is `fix/nre-reporting-accuracy-and-review`, based on `main`. A push stores the branch in GitHub; opening a pull request makes the proposed changes reviewable. Neither action alone updates nextreport.in.

## Your steps

1. Open the PR link supplied with this work. Read its summary, checks and remaining issues. In **Files changed**, review the core accounting, upload validation, API diagnostics, limited frontend changes and tests. There are no template assets or production schema migrations in this change.
2. Open the Vercel Preview link on the PR, if configured. Confirm Preview uses appropriate test services before generating reports: Preview variables can point to production databases, payments, Blob or email.
3. Upload fresh copies of approved source exports. Select the same client timezone, dates, campaigns and objectives as your manual calculation. Compare spend, Results, CTR, CPC, Reach and CPR in preview and in both downloaded deck themes. Include a Website Leads zero-result/spend day and a purchases export with a secondary lead column. Inspect mismatches instead of ignoring them. Existing stored decks do not recalculate.
4. Wait for CI and inspect every remaining failure. This branch's new acceptance tests do not certify every historical/API case. Do not merge a draft PR with unresolved acceptance blockers.
5. When satisfied, use GitHub **Ready for review**, then **Squash and merge** into `main` (if that is your repository policy). You do not need to run Git commands merely to merge the PR.
6. In Vercel → your NextReport project → **Deployments**, find the deployment for the merge commit. Wait for **Ready** and verify it targets Production. This requires Vercel's Git integration to connect `nextreport-app/NRE` with Production Branch `main`; those private settings were not verified here.
7. Repeat a small fresh-upload smoke test at nextreport.in before sending new client decks.

The cloud workspace configuration is separate: publishing that configuration saves a development environment. It does not deploy the website. This task prepares code and a PR; it does not merge or deploy production.

## Example acceptance data

With a reporting window containing Oct 1, 2026:

```csv
Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Initiate checkout,Cost per initiate checkout,Reach,Impressions
Campaign A,Set A,2026-10-01,Initiate checkout,2,100,2,50,100,200
```

Expected campaign and Combined Total: **2 checkouts, $100 spend, $50.00 CPR**. The $50 cost column must not become 50 extra checkouts. For a current-period wizard test, create a clearly labeled disposable fixture dated yesterday in the test client's timezone; preserve the values. Do not alter real client exports to make a test pass.

## Later fixes

Once this branch is pushed, further commits pushed to the same branch automatically update the PR and normally trigger a new preview. CI checks run on that new commit. You do not create another PR for each correction to this one.

Useful local checks:

```bash
npm run test:reporting-accuracy -- --maxWorkers=1
npm run test:objective-regression -- --maxWorkers=2
npm run test:api-routes -- --maxWorkers=2
npx tsc --noEmit
# Build also runs prisma migrate deploy; use a disposable local test DB.
DATABASE_URL=postgresql://nre@127.0.0.1:5432/nre npm run build
```

Never paste credentials into chat or commit `.env.local`. This environment's database is disposable, not the production database.

## Recovery

If CI fails, fix the branch and re-run the relevant checks. If production deployment fails, inspect its build log; a merge does not prove a successful release. If a deployed change breaks an approved report, use Vercel to roll back/promote the last verified deployment, then revert the merge in GitHub so the next build cannot reintroduce it. This branch introduces no database schema change. Re-generate affected stored decks and verify them before sharing.
