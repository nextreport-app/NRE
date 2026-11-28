import { expect, it, vi } from "vitest";
import { readOperationResponse } from "../read-operation-response";
it("handles split stream chunks without inventing progress or early completion", async () => {
  const encoder = new TextEncoder();
  const r = new Response(
    new ReadableStream({
      start(c) {
        for (const piece of [
          '{"progress":20}\n{"pro',
          'gress":80}\n',
          '{"progress":100,"url":"https://slides.test/ready"}\n',
        ])
          c.enqueue(encoder.encode(piece));
        c.close();
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson" } },
  );
  const update = vi.fn();
  expect(await readOperationResponse(r, update)).toMatchObject({
    url: "https://slides.test/ready",
  });
  expect(update.mock.calls.map((c) => c[0])).toEqual([20, 80, 100]);
});
it("does not convert an error into full green", async () => {
  const update = vi.fn();
  const r = new Response('{"progress":40}\n{"error":"profile changed"}\n', {
    headers: { "Content-Type": "application/x-ndjson" },
  });
  expect(await readOperationResponse(r, update)).toEqual({
    error: "profile changed",
  });
  expect(update).toHaveBeenCalledWith(40);
  expect(update).not.toHaveBeenCalledWith(100);
});
