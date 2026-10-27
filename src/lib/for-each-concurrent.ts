/** Bound parallel external work while still awaiting every item. */
export async function forEachConcurrent<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.floor(limit))) }, async () => {
    for (;;) { const index = next++; if (index >= items.length) return; await worker(items[index]); }
  }));
}
