import { reportSchedulerSecret } from "./secret";
import { prisma } from "../prisma";
export async function schedulerHealth(now = new Date()) {
  const state = await prisma.reportSchedulerState.findUnique({
    where: { id: "main" },
  });
  const configured =
    process.env.REPORT_SCHEDULER_ENABLED === "true" &&
    !!reportSchedulerSecret();
  const age = state ? now.getTime() - state.checkedAt.getTime() : null;
  return {
    configured,
    lastTickAt: state?.checkedAt.toISOString() ?? null,
    healthy: configured && age !== null && age >= 0 && age < 20 * 60000,
  };
}
