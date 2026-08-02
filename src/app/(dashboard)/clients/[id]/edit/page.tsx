import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/client-form";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/clients/${client.id}`} className="text-[13px] text-dash-ink-secondary hover:text-dash-ink">
        ← Back to {client.accountName}
      </Link>
      <h1 className="mb-6 mt-2 text-[24px] font-bold text-dash-ink">Edit Client</h1>
      <ClientForm
        clientId={client.id}
        initial={{
          accountName: client.accountName,
          currency: client.currency,
          timezone: client.timezone,
          monthlyBudget: client.monthlyBudget,
          template: client.template,
        }}
        hasLogo={!!client.logoUrl}
      />
    </div>
  );
}
