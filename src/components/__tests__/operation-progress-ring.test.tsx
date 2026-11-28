import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OperationProgressRing } from "../operation-progress-ring";
import { WizardStickyFooter } from "../report-upload-wizard/ui/wizard-sticky-footer";
it("keeps unknown work amber and stationary without claiming a percentage", () => {
  const html = renderToStaticMarkup(
    <OperationProgressRing label="Generating report" />,
  );
  expect(html).toContain('role="progressbar"');
  expect(html).not.toContain("animate-spin");
  expect(html).not.toContain("aria-valuenow");
});
it("keeps zero determinate and clamps measured progress", () => {
  for (const [input, expected] of [
    [0, 0],
    [-1, 0],
    [45, 45],
    [120, 100],
  ]) {
    const html = renderToStaticMarkup(
      <OperationProgressRing label="Download" progress={input} />,
    );
    expect(html).toContain(`aria-valuenow="${expected}"`);
    expect(html).not.toContain("animate-spin");
  }
  expect(
    renderToStaticMarkup(<OperationProgressRing progress={NaN} />),
  ).not.toContain("animate-spin");
});
it("disables the mobile Generate action while showing its busy ring", () => {
  const html = renderToStaticMarkup(
    <WizardStickyFooter
      primaryLabel="Generate Report"
      primaryLoadingLabel="Generating…"
      primaryLoading
      onPrimary={() => {}}
    />,
  );
  expect(html).toContain("Generating…");
  expect(html).toContain('disabled=""');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("nre-operation-ring");
});
