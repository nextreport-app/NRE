import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";

export const metadata: Metadata = {
  title: "Download Guide — NextReport",
};

function TipBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-900 bg-blue-950/30 p-4 text-sm text-blue-200">
      <p className="mb-1 font-medium">{title}</p>
      <p>{children}</p>
    </div>
  );
}

function ImportantBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
      <p className="mb-1 font-medium">{title}</p>
      <p>{children}</p>
    </div>
  );
}

function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-ink-secondary">
      {steps.map((step, i) => (
        <li key={i} className="pl-1">
          {step}
        </li>
      ))}
    </ol>
  );
}

export default async function DownloadGuidePage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link href={loggedIn ? "/clients" : "/"} className="text-sm text-accent hover:underline">
        ← Back to {loggedIn ? "Dashboard" : "NextReport"}
      </Link>

      <h1 className="mt-6 text-3xl font-semibold text-white">Download Guide</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
        NextReport works with CSV and Excel files downloaded directly from Meta Ads Manager or Google
        Ads. Follow either method below — both work with NextReport.
      </p>

      <div className="mt-10 space-y-12">
        <section>
          <h2 className="mb-1 text-lg font-medium text-white">Meta Ads — Method 1 (Recommended): Ad Reporting Section</h2>
          <p className="mb-4 text-sm text-ink-muted">
            Recommended because it includes all columns including Ad Set Name automatically.
          </p>
          <StepList
            steps={[
              "Log in to Meta Ads Manager",
              "Click the top left menu icon (hamburger menu)",
              "Select Ad Reporting from the menu",
              "Click Create Report or open an existing saved report",
              "Set your date range to This Month",
              "Set time increment to Day (daily breakdown)",
              <>
                Make sure these columns are included: Campaign Name, Ad Set Name, Day, Delivery Status,
                Reach, Impressions, Frequency, Result Type, Results, Amount Spent, Cost Per Result, CTR
                (All), CPC (All), Link Clicks, Landing Page Views, Cost Per Landing Page View, Reporting
                Starts, Reporting Ends
              </>,
              "Click Export and select CSV or Excel",
              "Upload the downloaded file to NextReport",
            ]}
          />
          <div className="mt-4">
            <TipBox title="Tip">
              Save your column selection as a preset in Meta so you do not have to reselect columns every
              time.
            </TipBox>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-medium text-white">Meta Ads — Method 2: Campaigns Screen Download</h2>
          <p className="mb-4 text-sm text-ink-muted">Works but requires an extra step to include Ad Set Name.</p>
          <StepList
            steps={[
              "Log in to Meta Ads Manager",
              "You will see your Campaigns list by default",
              "Click Columns at the top right of the table",
              "Select Customize Columns",
              <>
                Search for and add these columns: Ad Set Name, Day, Delivery Status, Reach, Impressions,
                Frequency, Result Type, Results, Amount Spent, Cost Per Result, CTR (All), CPC (All),
                Link Clicks, Landing Page Views
              </>,
              "Click Apply and then Save as Preset so you can reuse this next time",
              "Make sure the breakdown is set to Day (time increment)",
              "Set your date range to This Month at the top",
              "Click the Export button and select Export Table Data as CSV or Excel",
              "Upload the downloaded file to NextReport",
            ]}
          />
          <div className="mt-4">
            <ImportantBox title="Important">
              If you skip adding Ad Set Name to your columns, NextReport will not be able to show
              individual ad set slides or let you filter by ad set.
            </ImportantBox>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-white">Google Ads Download</h2>
          <StepList
            steps={[
              "Log in to Google Ads at ads.google.com",
              "Click Reports in the top navigation",
              "Select Predefined Reports then Basic then Campaign",
              "Set your date range to This Month at the top",
              "Set the time period to Day using the segment button",
              <>
                Click the Columns button and add: Campaign, Campaign type, Clicks, Impressions, CTR, Avg
                CPC, Cost, Conversions, Cost per conversion, Conversion rate, Search impression share
              </>,
              "Click the Download button and select CSV or Excel",
              "Upload the downloaded file to NextReport",
            ]}
          />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-white">Required columns for accurate objective detection</h2>
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-ink-secondary">
            <li>For Website Lead campaigns: include the Website leads column</li>
            <li>For Instant Form campaigns: include the Meta leads column</li>
            <li>For Purchase/Sales campaigns: include the Purchases column and Purchase ROAS column</li>
            <li>For Landing Page View campaigns: include the Landing page views column</li>
            <li>For Reach campaigns: include the Reach column and set Result type to Reach</li>
            <li>For Video campaigns: include the Video plays or ThruPlays column</li>
          </ul>
          <div className="mt-4">
            <TipBox title="Always include">
              Result type, Results, Cost per result — these three columns are the most reliable way for
              NextReport to detect your campaign objective automatically.
            </TipBox>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-white">Tips for Best Results</h2>
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-ink-secondary">
            <li>
              Always select This Month as your date range — NextReport automatically calculates the
              correct weekly and MTD periods
            </li>
            <li>
              Always use Day as the time increment — NextReport needs daily data to split weekly vs MTD
              automatically
            </li>
            <li>Save your column presets in Meta and Google so downloading takes under 2 minutes each time</li>
            <li>You can upload CSV, Excel (xlsx), TSV, or TXT files — NextReport accepts all formats</li>
          </ul>
        </section>
      </div>
      </main>
    </>
  );
}
