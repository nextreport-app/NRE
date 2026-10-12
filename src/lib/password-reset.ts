import "server-only";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";
import { normalizeAuthEmail } from "@/lib/normalize-auth-email";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function appOrigin(): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!fromEnv) return "https://nextreport.in";
  if (fromEnv.startsWith("http")) return fromEnv.replace(/\/$/, "");
  return `https://${fromEnv}`;
}

/** Always resolves — avoids email enumeration. */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, name: true },
  });
  if (!user?.passwordHash) return;

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { tokenHash, userId: user.id, expiresAt },
  });

  const resetUrl = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresMinutes: 60,
  });
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "Reset link is invalid or expired." };

  const tokenHash = hashToken(trimmed);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, passwordHash: true } } },
  });

  if (!row || row.expiresAt.getTime() < Date.now()) {
    if (row) await prisma.passwordResetToken.delete({ where: { id: row.id } }).catch(() => undefined);
    return { ok: false, error: "Reset link is invalid or expired. Request a new one from the login page." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);

  return { ok: true };
}
