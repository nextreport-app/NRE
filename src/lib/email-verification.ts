import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { FROM_ADDRESS, getResendClient } from "./email";
import { appBaseUrl } from "./app-base-url";
import { ServiceError } from "./service-error";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function sendVerificationEmail(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerified) return;
  if (!process.env.RESEND_API_KEY) throw new ServiceError("Email delivery is unavailable. Contact hello@nextreport.in.", 503);
  const token = randomBytes(32).toString("hex");
  const identifier = `verify-email:${userId}`;
  await prisma.$transaction(async tx => {
    await tx.verificationToken.deleteMany({ where: { identifier } });
    await tx.verificationToken.create({ data: { identifier, token: hash(token), expires: new Date(Date.now() + 86400000) } });
  });
  const link = `${appBaseUrl()}/verify-email?token=${token}`;
  const { error } = await getResendClient().emails.send({ from: FROM_ADDRESS, to: user.email, subject: "Verify your NextReport email", text: `Confirm your email to add clients and generate reports. This link expires in 24 hours.\n\n${link}\n\nIf you did not create this account, ignore this email.` });
  if (error) throw new ServiceError("Could not send verification email. Please retry or contact support.", 503);
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  return prisma.$transaction(async tx => {
    const row = await tx.verificationToken.findUnique({ where: { token: hash(token) } });
    if (!row || !row.identifier.startsWith("verify-email:") || row.expires <= new Date()) return false;
    const consumed = await tx.verificationToken.deleteMany({ where: { token: row.token, expires: { gt: new Date() } } });
    if (!consumed.count) return false;
    await tx.user.update({ where: { id: row.identifier.slice("verify-email:".length) }, data: { emailVerified: new Date() } });
    return true;
  });
}
