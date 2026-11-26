import { createHash } from "node:crypto";
import { effectiveBudgetTolerance, type BudgetConfig, type BudgetLevel } from "./budget-monitor-facts";
export function budgetAlertKey(id:string,month:string,config:BudgetConfig,level:BudgetLevel,tone?: "critical" | "warning" | "neutral") {
  const hash=createHash("sha256").update(JSON.stringify({version:2,tolerance:effectiveBudgetTolerance(config),monthlyBudget:config.monthlyBudget,currency:config.currency,timezone:config.timezone,metaAdAccountId:config.metaAdAccountId})).digest("hex").slice(0,20);
  return `budget:${id}:${month}:${hash}:${level}${tone === "critical" ? ":critical" : ""}`;
}
