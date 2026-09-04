import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { fileEntryFromFormData } from "@/lib/http-file";
import { saveSupportTicketAttachment } from "@/lib/storage";
import { supportTicketFieldsSchema } from "@/lib/validators/support-ticket";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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
  if (fields.reportId) {
    const report = await prisma.report.findFirst({
      where: { id: fields.reportId, client: { userId: user.id } },
      select: { displayName: true, fileName: true },
    });
    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 400 });
    }
    reportDisplayName = report.displayName ?? report.fileName;
  }

  const attachment = await fileEntryFromFormData(formData, "attachment");
  if (attachment && attachment.buffer.length > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Attachment must be 10 MB or smaller." }, { status: 400 });
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

    if (attachment && attachment.buffer.length > 0) {
      const attachmentUrl = await saveSupportTicketAttachment(
        ticket.id,
        attachment.buffer,
        attachment.fileName,
        attachment.contentType,
      );
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          attachmentUrl,
          attachmentFileName: attachment.fileName,
        },
      });
    }

    return NextResponse.json({ ok: true, ticketId: ticket.id });
  } catch (err) {
    return apiErrorResponse(err, "support:submit");
  }
}
