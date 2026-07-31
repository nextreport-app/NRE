import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validators/contact";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * /contact form submissions. Deliberately public, same reasoning as
 * api/waitlist/route.ts: most visitors filling this out are anonymous
 * marketing-page traffic, not logged-in accounts, so there's no auth()
 * check here.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name, email, subject, message } = parsed.data;

  try {
    await prisma.contactMessage.create({ data: { name, email, subject, message } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "contact:submit");
  }
}
