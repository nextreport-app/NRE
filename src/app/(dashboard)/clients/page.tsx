import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEMPLATE_LABELS } from "@/lib/validators/client";

export default async function ClientsPage() {
  const session = await auth();
  const clients = session?.user
    ? await prisma.client.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Clients</h1>
          <p className="mt-1 text-sm text-ink-muted">
            One profile per ad account. Reports are generated per client.
          </p>
        </div>
        <Link
          href="/clients/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + New client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-navy-border p-10 text-center">
          <p className="text-ink-muted">No clients yet.</p>
          <Link href="/clients/new" className="mt-3 inline-block text-accent hover:underline">
            Add your first client
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-navy-border rounded-lg border border-navy-border bg-navy-panel">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/clients/${client.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-navy-border/60"
              >
                <div>
                  <p className="font-medium text-white">{client.accountName}</p>
                  <p className="text-xs text-ink-muted">
                    {client.currency} · {client.timezone} · {TEMPLATE_LABELS[client.template]}
                  </p>
                </div>
                <span className="text-sm text-ink-muted">Manage →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
