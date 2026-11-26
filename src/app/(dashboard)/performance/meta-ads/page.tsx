import { AgencyOverview } from "@/components/agency-overview";
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  return (
    <AgencyOverview
      key={params.client ?? "all"}
      initialClientId={params.client ?? ""}
    />
  );
}
