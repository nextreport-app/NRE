ALTER TABLE "ReportReminder" DROP CONSTRAINT "ReportReminder_cadence_check";
ALTER TABLE "ReportReminder" ADD CONSTRAINT "ReportReminder_cadence_check"
CHECK ("cadence" IN ('WEEKLY','FORTNIGHTLY','MONTHLY','CUSTOM','MONTHLY_FIXED','ONCE'));
