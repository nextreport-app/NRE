import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { ClientForm } from "@/components/client-form";

export default async function NewClientPage() {
  const session = await auth();
  if (!session?.user) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-white">New client</h1>
      <ClientForm />
    </div>
  );
}
