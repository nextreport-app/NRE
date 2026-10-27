import type { Prisma } from "@/generated/prisma/client";
import { del } from "@vercel/blob";
import { prisma } from "./prisma";
export async function queueBlobDeletions(tx: Prisma.TransactionClient, urls: (string | null | undefined)[]) {
  const unique = [...new Set(urls.filter((url): url is string => !!url))];
  if (unique.length) await tx.blobDeletion.createMany({ data: unique.map(url => ({ url })), skipDuplicates: true });
}
/** Successful deletes are removed; failures remain durable for the next cron run. */
export async function drainBlobDeletionQueue(limit = 50): Promise<number> {
  const batch = await prisma.blobDeletion.findMany({ take: limit, orderBy: { createdAt: "asc" } });
  if (!batch.length) return 0;
  try {
    await del(batch.map(item => item.url));
    await prisma.blobDeletion.deleteMany({ where: { url: { in: batch.map(item => item.url) } } });
    return batch.length;
  } catch (err) { console.error("[blob-deletion] retry retained", err); return 0; }
}
