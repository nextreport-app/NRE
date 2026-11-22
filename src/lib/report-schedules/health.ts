import { prisma } from "../prisma";
export async function schedulerHealth(now = new Date()) {
  const state = await prisma.reportSchedulerState.findUnique({
    where: { id: "main" },
  });
  const configured = process.env.REPORT_SCHEDULER_ENABLED === "true";
  return {
    configured,
    lastTickAt: state?.checkedAt.toISOString() ?? null,
    healthy:
      configured &&
      !!state &&
      now.getTime() - state.checkedAt.getTime() < 20 * 60000,
  };
}
