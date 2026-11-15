import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetaApiLeadScopeNotice } from "../ui/meta-api-lead-scope-notice";
it("states the unresolved grouped versus primary lead scope without blocking API use", () => {
 const html = renderToStaticMarkup(<MetaApiLeadScopeNotice show />);
 expect(html).toContain("grouped Meta lead counts"); expect(html).toContain("exact primary Results");
 expect(html).not.toContain("button"); expect(html).not.toContain("disabled");
 expect(renderToStaticMarkup(<MetaApiLeadScopeNotice show={false} />)).toBe("");
});
