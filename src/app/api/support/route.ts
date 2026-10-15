import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { fileEntriesFromFormData } from "@/lib/http-file";
import {
  presignedPrivateBlobGetUrl,
  readReportFile,
  saveSupportTicketAttachment,
} from "@/lib/storage";
import { supportTicketFieldsSchema } from "@/lib/validators/support-ticket";
import { autoReplyFireAndForget, sendInboundEmail, type InboundEmailAttachment } from "@/lib/inbound-notifications";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function parseIncludeReportDeck(formData: FormData): boolean {
  const raw = formData.get("includeReportDeck");
  if (raw === null || raw === undefined || raw === "") return true;
  if (typeof raw === "string") return raw === "true" || raw === "1" || raw === "on";
  return false;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to raise a support ticket." }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const parsed = supportTicketFieldsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    category: formData.get("category"),
    message: formData.get("message"),
    clientId: formData.get("clientId") || undefined,
    reportId: formData.get("reportId") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const fields = parsed.data;
  const includeReportDeck = parseIncludeReportDeck(formData);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, planId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  let clientName: string | null = null;
  if (fields.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: fields.clientId, userId: user.id },
      select: { accountName: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 400 });
    }
    clientName = client.accountName;
  }

  let reportDisplayName: string | null = null;
  let reportFilePath: string | null = null;
  let reportFileName: string | null = null;
  if (fields.reportId) {
    const report = await prisma.report.findFirst({
      where: { id: fields.reportId, client: { userId: user.id } },
      select: { displayName: true, fileName: true, filePath: true, status: true },
    });
    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 400 });
    }
    reportDisplayName = report.displayName ?? report.fileName;
    if (includeReportDeck && report.status === "COMPLETE" && report.filePath) {
      reportFilePath = report.filePath;
      reportFileName = report.fileName || "report.pptx";
    }
  }

  const uploadedFiles = await fileEntriesFromFormData(formData, "attachment");
  for (const file of uploadedFiles) {
    if (file.buffer.length > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "Each attachment must be 10 MB or smaller." }, { status: 400 });
    }
  }

  const emailAttachments: InboundEmailAttachment[] = uploadedFiles.map((file) => ({
    fileName: file.fileName,
    content: file.buffer,
    contentType: file.contentType,
  }));

  if (reportFilePath && reportFileName) {
    try {
      const deckBuffer = await readReportFile(reportFilePath);
      if (deckBuffer.length > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json(
          { error: "Report deck is too large to attach. Download it from report history instead." },
          { status: 400 },
        );
      }
      emailAttachments.push({
        fileName: reportFileName.endsWith(".pptx") ? reportFileName : `${reportFileName}.pptx`,
        content: deckBuffer,
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
    } catch {
      /* deck missing in storage — still send ticket with other files */
    }
  }

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        name: fields.name,
        email: fields.email,
        phone: fields.phone ?? null,
        category: fields.category,
        message: fields.message,
        planId: user.planId,
        clientId: fields.clientId ?? null,
        clientName,
        reportId: fields.reportId ?? null,
        reportDisplayName,
      },
    });

    const storedDownloadLinks: { fileName: string; url: string }[] = [];
    let primaryAttachmentUrl: string | null = null;
    let primaryAttachmentFileName: string | null = null;

    for (const file of uploadedFiles) {
      if (file.buffer.length === 0) continue;
      const url = await saveSupportTicketAttachment(ticket.id, file.buffer, file.fileName, file.contentType);
      if (!primaryAttachmentUrl) {
        primaryAttachmentUrl = url;
        primaryAttachmentFileName = file.fileName;
      }
      try {
        storedDownloadLinks.push({
          fileName: file.fileName,
          url: await presignedPrivateBlobGetUrl(url),
        });
      } catch {
        storedDownloadLinks.push({ fileName: file.fileName, url });
      }
    }

    if (primaryAttachmentUrl) {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          attachmentUrl: primaryAttachmentUrl,
          attachmentFileName: primaryAttachmentFileName,
        },
      });
    }

    const attachmentSummary =
      emailAttachments.length > 0
        ? emailAttachments.map((a) => a.fileName).join(", ")
        : null;

    const downloadLinksHtml =
      storedDownloadLinks.length > 0
        ? `<ul>${storedDownloadLinks
            .map(
              (l) =>
                `<li><a href="${l.url.replace(/"/g, "&quot;")}">${l.fileName.replace(/</g, "&lt;")}</a> (link expires in 7 days)</li>`,
            )
            .join("")}</ul>`
        : "";

    const teamSubject = `[Support] ${fields.category} — ${fields.name}`;
    const contextLines = [
      `Ticket ID: ${ticket.id}`,
      clientName ? `Client: ${clientName}` : null,
      reportDisplayName ? `Report: ${reportDisplayName}` : null,
      `Plan: ${user.planId}`,
    ]
      .filter(Boolean)
      .join("\n");

    void sendInboundEmail({
      channel: "support",
      subject: teamSubject,
      text: [
        "New in-app support ticket.",
        "",
        `Name: ${fields.name}`,
        `Email: ${fields.email}`,
        fields.phone ? `Phone: ${fields.phone}` : "",
        `Category: ${fields.category}`,
        contextLines,
        "",
        fields.message,
        attachmentSummary ? `\nAttachments (also in this email): ${attachmentSummary}` : "",
        storedDownloadLinks.length
          ? `\nDownload links (expire in 7 days):\n${storedDownloadLinks.map((l) => `${l.fileName}: ${l.url}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `<p>New in-app support ticket.</p>
<ul>
<li><strong>Name:</strong> ${fields.name}</li>
<li><strong>Email:</strong> ${fields.email}</li>
<li><strong>Category:</strong> ${fields.category}</li>
<li><strong>Plan:</strong> ${user.planId}</li>
${clientName ? `<li><strong>Client:</strong> ${clientName}</li>` : ""}
${reportDisplayName ? `<li><strong>Report:</strong> ${reportDisplayName}</li>` : ""}
</ul>
<p style="white-space:pre-wrap">${fields.message.replace(/</g, "&lt;")}</p>
${
  attachmentSummary
    ? `<p><strong>Attachments:</strong> ${attachmentSummary.replace(/</g, "&lt;")} (included in this email)</p>${downloadLinksHtml}`
    : ""
}`,
      replyTo: fields.email,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    autoReplyFireAndForget({
      to: fields.email,
      subject: "Support ticket received — NextReport",
      text: [
        `Hi ${fields.name},`,
        "",
        "We received your support ticket and will reply within one business day.",
        "",
        `Category: ${fields.category}`,
        "",
        "— NextReport support",
        "support@nextreport.in",
      ].join("\n"),
      html: `<p>Hi ${fields.name},</p>
<p>We received your support ticket and will reply within one business day.</p>
<p><strong>Category:</strong> ${fields.category}</p>
<p>— NextReport support<br/>support@nextreport.in</p>`,
    });

    return NextResponse.json({ ok: true, ticketId: ticket.id });
  } catch (err) {
    return apiErrorResponse(err, "support:submit");
  }
}
