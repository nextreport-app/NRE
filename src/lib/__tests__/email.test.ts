import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  // A plain function, not an arrow function — vi.fn()'s mock implementation
  // must itself be constructible for `new Resend(...)` in email.ts to work.
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: sendMock } };
  }),
}));

// Imported after the mock so the module under test picks up the mocked SDK.
const { sendReportEmail } = await import("../email");

const BASE_INPUT = {
  to: "client@example.com",
  clientName: "Acme Co",
  reportType: "Weekly",
  dateRange: "July 18 - July 24",
  shareLink: "https://nextreport.in/r/abc123",
  senderName: "Jordan Lee",
};

describe("sendReportEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockReset();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
  });

  it("returns success: false without calling Resend when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendReportEmail(BASE_INPUT);
    expect(result).toEqual({ success: false, error: "Email sending is not configured." });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends from hello@nextreport.in with reply-to the same address", async () => {
    sendMock.mockResolvedValue({ data: { id: "abc" }, error: null });
    await sendReportEmail(BASE_INPUT);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.from).toBe("hello@nextreport.in");
    expect(call.replyTo).toBe("hello@nextreport.in");
    expect(call.to).toBe("client@example.com");
  });

  it("includes the subject, html, and text built from the report props", async () => {
    sendMock.mockResolvedValue({ data: { id: "abc" }, error: null });
    await sendReportEmail(BASE_INPUT);

    const call = sendMock.mock.calls[0][0];
    expect(call.subject).toBe("Acme Co — Weekly Report — July 18 - July 24");
    expect(call.html).toContain("View Report");
    expect(call.text).toContain("https://nextreport.in/r/abc123");
  });

  it("returns success: true on a clean Resend response", async () => {
    sendMock.mockResolvedValue({ data: { id: "abc" }, error: null });
    const result = await sendReportEmail(BASE_INPUT);
    expect(result).toEqual({ success: true });
  });

  it("returns success: false with the Resend error message when Resend reports an error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "Domain not verified" } });
    const result = await sendReportEmail(BASE_INPUT);
    expect(result).toEqual({ success: false, error: "Domain not verified" });
  });

  it("returns a generic success: false when the Resend call throws", async () => {
    sendMock.mockRejectedValue(new Error("network down"));
    const result = await sendReportEmail(BASE_INPUT);
    expect(result).toEqual({ success: false, error: "Could not send the email. Please try again." });
  });
});
