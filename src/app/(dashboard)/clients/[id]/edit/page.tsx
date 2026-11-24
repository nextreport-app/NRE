import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.userId !== session.user.id) notFound();

  redirect(`/clients/${client.id}#client-settings`);
}
