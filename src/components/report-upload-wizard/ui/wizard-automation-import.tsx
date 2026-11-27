"use client";
import { automationSampleDateSelection } from "@/lib/report-schedules/wizard-options";
import { WizardDataSourcePanel } from "@/components/wizard-data-source-panel";
import { useWizardContext } from "../wizard-context";
export function WizardAutomationImport() {
  const w = useWizardContext();
  if (!w.automationCadence) return null;
  const analysisError =
    w.analyzeStatus === "error"
      ? w.analyzeMessage || "Could not analyze the synced data. Please retry."
      : w.analyzeStatus === "invalid"
        ? w.analyzeErrors.map((error) => error.message).join(" ") ||
          "Please check the synced data."
        : null;
  return (
    <div className="space-y-4 rounded-xl border border-dash-border bg-dash-card p-5">
      <p className="text-sm text-dash-ink-secondary">
        Connect your Meta Ads account once. Future reports fetch fresh data
        automatically using the choices you save in this wizard.
      </p>
      <WizardDataSourcePanel
        clientId={w.clientId}
        clientName={w.clientName}
        linkedMetaAdAccountId={w.linkedMetaAdAccountId}
        linkedMetaAdAccountName={w.linkedMetaAdAccountName}
        clientTimezone={w.clientTimezone}
        onTimezoneUpdated={w.updateApiTimezone}
        platform="META"
        reportSelection={{
          reportType: w.automationCadence,
          dateSelection: automationSampleDateSelection(
            w.automationCadence,
            new Date(),
            w.clientTimezone,
          ),
        }}
        metaConnected={w.metaConnected}
        metaConnectedName={w.metaConnectedName}
        metaConfigured={w.metaConfigured}
        googleAdsConnected={false}
        googleAdsConfigured={false}
        tiktokConnected={false}
        tiktokConfigured={false}
        onSynced={w.handleApiSynced}
        onSyncStart={w.handleApiSyncStart}
        syncStatus={w.analyzeStatus === "loading" ? "loading" : w.apiSyncStatus}
        syncError={w.apiSyncError || analysisError}
        onSyncError={(message) => {
          w.setApiSyncStatus("error");
          w.setApiSyncError(message);
        }}
        onMetaAccountChanged={w.handleApiAccountChange}
        onMetaAccountSelectionChange={w.setSelectedApiAdAccountId}
      />
    </div>
  );
}
