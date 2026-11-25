import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiSourceDownload } from "../ui/api-source-download";
it("makes the private source CSV available while keeping extra sync details collapsed", () => {
  const html = renderToStaticMarkup(
    <ApiSourceDownload clientId="client" uploadSessionId="snapshot" />,
  );
  expect(html).toContain("Download report source CSV");
  expect(html).toContain("Sync details");
  expect(html).not.toMatch(/<details[^>]*open/);
});
