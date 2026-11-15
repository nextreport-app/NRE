export interface FormCreative {
  id?: string;
  object_story_spec?: unknown;
  asset_feed_spec?: unknown;
  object_story_id?: string;
  effective_object_story_id?: string;
}
export interface FormDestinationConfig {
  formIds: string[];
  pageIds: string[];
  storyIds?: string[];
  adIds?: string[];
  creativeIdentities?: Array<{ adId: string; creativeId: string | null; formIds: string[]; pageIds: string[]; storyIds: string[] }>;
}

/** Resolve explicit Meta object relationships. Never interpret a reporting
 * destination's number/name to decide what kind of object it is. */
export function formCreativeIdentities(creatives: FormCreative[]): FormDestinationConfig {
  const forms = new Set<string>(), pages = new Set<string>(), stories = new Set<string>();
  function visit(value: unknown, found: Set<string>, depth = 0) {
    if (!value || typeof value !== "object" || depth > 12) return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "lead_gen_form_id" && typeof item === "string" && /^\d+$/.test(item)) found.add(item);
      else visit(item, found, depth + 1);
    }
  }
  for (const creative of creatives) {
    const ownForms = new Set<string>();
    visit(creative.object_story_spec, ownForms); visit(creative.asset_feed_spec, ownForms);
    if (!ownForms.size) continue;
    for (const form of ownForms) forms.add(form);
    const spec = creative.object_story_spec;
    const page = spec && typeof spec === "object" && "page_id" in spec ? spec.page_id : undefined;
    if (typeof page !== "string" || !/^\d+$/.test(page)) continue;
    pages.add(page);
    for (const story of [creative.object_story_id, creative.effective_object_story_id]) {
      if (typeof story !== "string") continue;
      if (/^\d+$/.test(story)) stories.add(story);
      else {
        const match = /^(\d+)_(\d+)$/.exec(story);
        // A compound published-story identity must agree with its own Page.
        if (match?.[1] === page) { stories.add(story); stories.add(match[2]); }
      }
    }
  }
  return { formIds: [...forms].sort(), pageIds: [...pages].sort(), storyIds: [...stories].sort() };
}
