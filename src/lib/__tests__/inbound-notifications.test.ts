import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: sendMock } };
  }),
}));

const { inboundNotifyRecipients, sendInboundEmail } = await import("../inbound-notifications");

describe("inbound-notifications", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "1" }, error: null });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("routes contact notifications to hello@ by default", () => {
    delete process.env.CONTACT_NOTIFY_EMAILS;
    expect(inboundNotifyRecipients("contact")).toEqual(["hello@nextreport.in"]);
  });

  it("routes support notifications to support@ by default", () => {
    delete process.env.SUPPORT_NOTIFY_EMAILS;
    expect(inboundNotifyRecipients("support")).toEqual(["support@nextreport.in"]);
  });

  it("sends team notification with visitor reply-to", async () => {
    const result = await sendInboundEmail({
      channel: "contact",
      subject: "Test",
      text: "Body",
      html: "<p>Body</p>",
      replyTo: "visitor@example.com",
    });

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["hello@nextreport.in"],
        replyTo: "visitor@example.com",
      }),
    );
  });

  it("forwards attachments to Resend", async () => {
    const csv = Buffer.from("campaign,clicks\nA,10\n");
    const result = await sendInboundEmail({
      channel: "support",
      subject: "Ticket with CSV",
      text: "See attached CSV.",
      html: "<p>See attached CSV.</p>",
      attachments: [{ fileName: "report.csv", content: csv, contentType: "text/csv" }],
    });

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["support@nextreport.in"],
        attachments: [
          {
            filename: "report.csv",
            content: csv,
            contentType: "text/csv",
          },
        ],
      }),
    );
  });

  it("skips when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendInboundEmail({
      channel: "contact",
      subject: "Test",
      text: "Body",
      html: "<p>Body</p>",
    });
    expect(result.skipped).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
