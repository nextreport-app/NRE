import { expect, it } from "vitest";
import { formCreativeIdentities } from "../meta-api-sync/form-creative-identities";
it("resolves a published story/post identity only through its own form-bearing creative and Page", () => {
 const result = formCreativeIdentities([
  { effective_object_story_id: "300_500", object_story_spec: { page_id: "300", link_data: { call_to_action: { value: { lead_gen_form_id: "200" } } } } },
  { effective_object_story_id: "999_600", object_story_spec: { page_id: "999" } },
  { effective_object_story_id: "999_666", object_story_spec: { page_id: "300", link_data: { call_to_action: { value: { lead_gen_form_id: "200" } } } } },
 ]);
 expect(result).toEqual({ formIds: ["200"], pageIds: ["300"], storyIds: ["300_500", "500"] });
 expect(result.storyIds).not.toContain("600"); expect(result.storyIds).not.toContain("666");
});
it("does not manufacture a relationship from a reporting destination number", () => {
 expect(formCreativeIdentities([{ object_story_spec: { page_id: "300", link_data: { call_to_action: { value: { lead_gen_form_id: "200" } } } } }])).toEqual({ formIds: ["200"], pageIds: ["300"], storyIds: [] });
});
