import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma",()=>({prisma:{blobDeletion:{findMany:vi.fn(),deleteMany:vi.fn()}}}));
vi.mock("@vercel/blob",()=>({del:vi.fn()}));
import { prisma } from "../prisma";
import { del } from "@vercel/blob";
import { drainBlobDeletionQueue } from "../blob-deletion-outbox";
describe("durable storage deletion",()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.mocked(prisma.blobDeletion.findMany).mockResolvedValue([{url:"https://private.example/report.pptx",createdAt:new Date()}]);});
  it("retains cleanup intent if storage deletion fails",async()=>{vi.mocked(del).mockRejectedValueOnce(new Error("Synthetic storage outage"));expect(await drainBlobDeletionQueue()).toBe(0);expect(prisma.blobDeletion.deleteMany).not.toHaveBeenCalled();});
  it("removes intent only after successful storage deletion",async()=>{vi.mocked(del).mockResolvedValueOnce(undefined);expect(await drainBlobDeletionQueue()).toBe(1);expect(prisma.blobDeletion.deleteMany).toHaveBeenCalledOnce();});
});
