import { createHash } from "node:crypto";
import type { BudgetConfig, BudgetLevel } from "./budget-monitor-facts";
export function budgetAlertKey(id:string,month:string,config:BudgetConfig,level:BudgetLevel) {
  const hash=createHash("sha256").update(JSON.stringify({monthlyBudget:config.monthlyBudget,currency:config.currency,timezone:config.timezone,metaAdAccountId:config.metaAdAccountId})).digest("hex").slice(0,20);
  return `budget:${id}:${month}:${hash}:${level}`;
}
