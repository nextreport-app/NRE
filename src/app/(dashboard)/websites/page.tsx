import { WebsiteDashboard } from "@/components/website-dashboard";
export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  return <WebsiteDashboard initialClientId={params.client ?? ""} />;
}
