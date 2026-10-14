import { HelpDocShell, helpDocMetadata } from "@/components/help/help-doc-shell";

export const metadata = helpDocMetadata({
  title: "Campaign objectives",
  description:
    "How NextReport reads Result type and Results from your Meta CSV and how to confirm objectives in the wizard.",
  path: "/help/objectives",
});

export default function HelpObjectivesPage() {
  return (
    <HelpDocShell
      title="How we pick objectives"
      subtitle="What Step 2 (Campaigns) is doing with your CSV"
    >
      <section className="space-y-4">
        <p>
          Each campaign slide needs one primary result label — quotes, leads, landing page views, purchases, and so on.
          We read that from your export, then you confirm anything we&apos;re unsure about.
        </p>
        <h2 className="text-lg font-semibold text-white">What we read from the CSV</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>
            <span className="text-white">Result type</span> and <span className="text-white">Results</span> columns on
            each row
          </li>
          <li>Campaign name patterns (e.g. Reach, Leads, LPV in the name)</li>
          <li>Which conversion columns have spend attached in the file</li>
        </ul>
        <h2 className="text-lg font-semibold text-white">When we ask you to confirm</h2>
        <p>
          If a campaign could map to more than one result, or spend is low, you&apos;ll see a badge on Step 2. Pick the
          objective that matches what the client cares about — that choice drives results and cost-per-result on slides
          and in CSV verification.
        </p>
        <h2 className="text-lg font-semibold text-white">Mixed accounts</h2>
        <p>
          Reach, lead gen, and traffic campaigns in the same file each keep their own objective. We never force one
          global result type across the whole account.
        </p>
      </section>
    </HelpDocShell>
  );
}
