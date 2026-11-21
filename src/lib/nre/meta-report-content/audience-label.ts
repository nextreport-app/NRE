/** Display aliases only. Source values and grouping identities remain unchanged. */
const platforms: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", audience_network: "Audience Network",
  messenger: "Messenger", threads: "Threads", unknown: "Uncategorised",
};
const placements: Record<string, string> = {
  feed: "Feed", an_classic: "Native/banner/interstitial", rewarded_video: "Rewarded video",
  facebook_reels: "Reels", facebook_reels_overlay: "Reels overlay",
  facebook_notification: "Notifications", facebook_profile_feed: "Profile feed",
  facebook_stories: "Stories", instream_video: "In-stream video", marketplace: "Marketplace",
  right_hand_column: "Right column", search: "Search", video_feeds: "Video feeds",
  instagram_reels: "Reels", instagram_stories: "Stories", instagram_search: "Search",
  instagram_profile_feed: "Profile feed", instagram_explore: "Explore",
  instagram_explore_home: "Explore home", instagram_lead_gen_multi_submit: "Lead generation multi-submit",
  messenger_inbox: "Inbox", messenger_stories: "Stories", sponsored_messages: "Sponsored messages",
  threads_feed: "Feed", unknown: "Uncategorised",
};
export function metaAudienceLabel(value: string, kind: "platform" | "placement"): string {
  const map = kind === "platform" ? platforms : placements;
  // Preserve new or custom labels verbatim rather than guess their meaning.
  return map[value.toLowerCase()] ?? value;
}
