import { SearchConsoleDashboard } from "@/components/search-console-dashboard";
export default async function SearchConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return (
    <SearchConsoleDashboard
      key={client ?? "all"}
      initialClientId={client ?? ""}
    />
  );
}
